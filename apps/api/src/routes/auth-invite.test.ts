import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  createAuthService,
  createInviteService,
  createUserService,
} from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import type { LiteDatabase } from '@rxwf/providers-lite';

function sessionCookieFromResponse(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers['set-cookie'];
  const line = Array.isArray(raw) ? raw[0] : raw;
  if (!line) return undefined;
  const match = line.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

describe('auth invite routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: LiteDatabase;

  beforeAll(async () => {
    db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/accept-invite activates pending user', async () => {
    const users = createUserService(db);
    const invites = createInviteService(db);
    const admin = await users.createUser({
      email: 'admin-invite@test.com',
      password: 'secret1234',
      role: 'admin',
    });
    const pending = await users.createPendingInviteUser({
      email: 'invited@test.com',
      role: 'member',
      invitedByUserId: admin.id,
    });
    const { token } = await invites.createToken(pending.id, admin.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/accept-invite',
      payload: { token, password: 'newpass1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const row = await users.findById(pending.id);
    expect(row?.status).toBe('active');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'invited@test.com', password: 'newpass1234' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('status returns mustChangePassword for direct create user', async () => {
    const users = createUserService(db);
    const auth = createAuthService(db);
    await users.createDirectUser({
      email: 'must-change@test.com',
      password: 'temp123456',
      role: 'member',
      mustChangePassword: true,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'must-change@test.com', password: 'temp123456' },
    });
    expect(login.statusCode).toBe(200);
    const sessionToken = sessionCookieFromResponse(login.headers);
    expect(sessionToken).toBeTruthy();

    const status = await app.inject({
      method: 'GET',
      url: '/api/auth/status',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      authenticated: true,
      user: {
        email: 'must-change@test.com',
        role: 'member',
        mustChangePassword: true,
      },
    });
  });
});
