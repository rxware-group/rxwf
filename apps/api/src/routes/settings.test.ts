import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SESSION_COOKIE_NAME } from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('settings routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let adminCookie: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    app = built.app;
    await app.ready();
    const setup = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { email: 'admin@test.com', password: 'secret123' },
    });
    const raw = setup.headers['set-cookie'];
    const line = Array.isArray(raw) ? raw[0] : raw;
    adminCookie = `${SESSION_COOKIE_NAME}=${line?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1]}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/settings/system requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings/system' });
    expect(res.statusCode).toBe(401);
  });

  it('admin can read runtime summary', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/api/settings/system',
      headers: { cookie: adminCookie },
    });
    expect(get.statusCode).toBe(200);
    const body = get.json() as { passwordResetEnabled: boolean; smtpConfigured: boolean };
    expect(typeof body.passwordResetEnabled).toBe('boolean');
    expect(typeof body.smtpConfigured).toBe('boolean');
  });

  it('platform env updates affect runtime via PUT /api/env', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { cookie: adminCookie },
      payload: { items: [{ key: 'RXWF_PUBLIC_URL', value: 'http://localhost:9999' }] },
    });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({
      method: 'GET',
      url: '/api/settings/system',
      headers: { cookie: adminCookie },
    });
    expect(get.statusCode).toBe(200);
  });
});
