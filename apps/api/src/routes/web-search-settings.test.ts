import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('web search settings routes', () => {
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

  it('GET /api/settings/web-search requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings/web-search' });
    expect(res.statusCode).toBe(401);
  });

  it('GET returns defaults when unset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings/web-search',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      enabled: false,
      defaultProvider: 'tavily',
      maxQueriesPerExecution: 10,
    });
  });

  it('PUT persists web search settings', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/settings/web-search',
      headers: { cookie: adminCookie },
      payload: {
        enabled: true,
        defaultProvider: 'brave',
        maxResults: 5,
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ ok: true, enabled: true, defaultProvider: 'brave' });

    const get = await app.inject({
      method: 'GET',
      url: '/api/settings/web-search',
      headers: { cookie: adminCookie },
    });
    expect((get.json() as { defaultProvider: string }).defaultProvider).toBe('brave');
  });

  it('POST test returns preview with mocked fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [{ title: 'Ping OK', url: 'https://example.com', description: 'works' }],
        },
      }),
    });

    const createCred = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { cookie: adminCookie },
      payload: {
        name: 'web-search-test',
        type: 'apiKey',
        data: { apiKey: 'brave-test-key' },
      },
    });
    expect(createCred.statusCode).toBe(201);
    const credentialId = (createCred.json() as { id: string }).id;

    await app.inject({
      method: 'PUT',
      url: '/api/settings/web-search',
      headers: { cookie: adminCookie },
      payload: {
        enabled: true,
        defaultProvider: 'brave',
        defaultCredentialId: credentialId,
      },
    });

    const test = await app.inject({
      method: 'POST',
      url: '/api/settings/web-search/test',
      headers: { cookie: adminCookie },
    });
    expect(test.statusCode).toBe(200);
    const body = test.json() as { ok: boolean; preview: string; latencyMs: number };
    expect(body.ok).toBe(true);
    expect(body.preview).toContain('Ping OK');
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
