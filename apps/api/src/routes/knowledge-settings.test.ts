import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SESSION_COOKIE_NAME } from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('knowledge settings routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      seedKnowledgePlatformConfig: true,
    });
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

    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@test.com', password: 'secret123' },
    });
    void memberRes;
    memberCookie = adminCookie;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/settings/knowledge returns config for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings/knowledge',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { configured: boolean; embedding: { defaultModel: string } };
    expect(body.configured).toBe(true);
    expect(body.embedding.defaultModel).toBeTruthy();
  });

  it('GET is read-only for non-admin fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings/knowledge',
      headers: { cookie: memberCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ editable: true });
  });

  it('PUT requires valid rag model id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings/knowledge',
      headers: { cookie: adminCookie },
      payload: {
        rag: { defaultModelId: 'missing-model-id' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT updates defaults', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings/knowledge',
      headers: { cookie: adminCookie },
      payload: {
        defaults: { topK: 7 },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, defaults: { topK: 7 } });
  });
});
