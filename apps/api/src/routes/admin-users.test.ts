import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

async function createUserWithKey(
  db: Awaited<ReturnType<typeof createTestDb>>,
  role: 'admin' | 'member',
) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `${role}-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role,
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return { user, key };
}

describe('admin users API', () => {
  it('GET /api/admin/users as member → 403', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const { key } = await createUserWithKey(db, 'member');

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'E1003' });
    await app.close();
  });

  it('POST /api/admin/users as admin → 201 with user', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const { key } = await createUserWithKey(db, 'admin');

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { 'x-api-key': key },
      payload: {
        email: 'u@x.com',
        password: 'secret1234',
        mustChangePassword: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      user: { id: string; email: string; isAdmin: boolean; status: string };
      temporaryPassword?: string;
    };
    expect(body.user).toMatchObject({
      email: 'u@x.com',
      isAdmin: false,
      status: 'active',
    });
    expect(body.temporaryPassword).toBeDefined();
    await app.close();
  });
});
