import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SESSION_COOKIE_NAME, createPasswordResetService, createUserService } from '@rxwf/identity';
import { parseCredentialKey } from '@rxwf/credential';
import { createTestDb } from '@rxwf/providers-lite';
import {
  createSystemSettingsService,
  SETTING_KEYS,
} from '@rxwf/system-settings';
import { buildApp } from '../app.js';
import { config } from '../config.js';
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

describe('auth routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: LiteDatabase;
  let settingsService: ReturnType<typeof createSystemSettingsService>;

  beforeAll(async () => {
    db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    settingsService = createSystemSettingsService(
      db,
      parseCredentialKey(config.credentialKey),
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports needsSetup when no users exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ needsSetup: true, authenticated: false });
  });

  it('returns password-reset-status disabled by default', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/password-reset-status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
  });

  it('creates admin on setup and authenticates via session cookie', async () => {
    const setup = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { email: 'admin@test.com', password: 'secret123' },
    });
    expect(setup.statusCode).toBe(201);
    const token = sessionCookieFromResponse(setup.headers);
    expect(token).toBeTruthy();

    const status = await app.inject({
      method: 'GET',
      url: '/api/auth/status',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(status.json()).toMatchObject({
      needsSetup: false,
      authenticated: true,
      user: { email: 'admin@test.com', role: 'admin' },
    });

    const workflows = await app.inject({
      method: 'GET',
      url: '/api/workflows',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(workflows.statusCode).toBe(200);
  });

  it('rejects duplicate setup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { email: 'other@test.com', password: 'secret123' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('logs in with email and password', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'secret123' },
    });
    expect(login.statusCode).toBe(200);
    const token = sessionCookieFromResponse(login.headers);
    const res = await app.inject({
      method: 'GET',
      url: '/api/workflows',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns password-reset-status enabled after smtp is configured', async () => {
    await settingsService.set(SETTING_KEYS.smtpHost, 'smtp.test');
    await settingsService.set(SETTING_KEYS.smtpPort, '587');
    await settingsService.set(SETTING_KEYS.smtpFrom, 'noreply@test.com');

    const res = await app.inject({ method: 'GET', url: '/api/auth/password-reset-status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: true });
  });

  it('forgot-password always returns 200 with unified message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'unknown@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      message: '如果该邮箱已注册，您将收到重置邮件。',
    });
  });

  it('reset password then login works', async () => {
    const users = createUserService(db);
    const reset = createPasswordResetService(db);
    const user = await users.findByEmail('admin@test.com');
    expect(user).toBeTruthy();

    const { token } = await reset.createToken(user!.id);
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'newpass123' },
    });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json()).toEqual({ ok: true });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'newpass123' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({
      user: { email: 'admin@test.com', role: 'admin' },
    });
  });
});
