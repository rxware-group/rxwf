import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SESSION_COOKIE_NAME } from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('rxwf workspace routes', () => {
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

  it('GET /api/rxwf/workspace requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rxwf/workspace' });
    expect(res.statusCode).toBe(401);
  });

  it('GET returns empty when unset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rxwf/workspace',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ workspaceRoot: '' });
  });

  it('PUT persists workspace root', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/rxwf/workspace',
      headers: { cookie: adminCookie },
      payload: { workspaceRoot: '  /tmp/my-workspace  ' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ ok: true, workspaceRoot: '/tmp/my-workspace' });

    const get = await app.inject({
      method: 'GET',
      url: '/api/rxwf/workspace',
      headers: { cookie: adminCookie },
    });
    expect((get.json() as { workspaceRoot: string }).workspaceRoot).toBe('/tmp/my-workspace');
  });
});
