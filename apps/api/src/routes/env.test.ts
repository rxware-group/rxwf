import { describe, it, expect } from 'vitest';
import { PLATFORM_ENV_KEYS } from '@rxwf/env';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `env-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role: 'admin',
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return key;
}

async function viewerKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `env-viewer-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role: 'viewer',
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return key;
}

describe('env routes', () => {
  it('GET /api/env returns whitelist platform items', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'GET',
      url: '/api/env',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(200);
    const items = (res.json() as {
      items: Array<{
        key: string;
        valueType?: string;
        pathHost?: string;
        pathKind?: string;
      }>;
    }).items;
    expect(items).toHaveLength(PLATFORM_ENV_KEYS.size);
    expect(items.every((item) => item.key.startsWith('RXWF_'))).toBe(true);
    const workspace = items.find((i) => i.key === 'RXWF_WORKSPACE_ROOT');
    expect(workspace?.valueType).toBe('path');
    expect(workspace?.pathHost).toBe('runner');
    expect(workspace?.pathKind).toBe('directory');
    await app.close();
  });

  it('GET /api/env/browse controlPlane lists directories for admin', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'GET',
      url: '/api/env/browse?host=controlPlane&path=',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { host: string; entries: unknown[] };
    expect(body.host).toBe('controlPlane');
    expect(Array.isArray(body.entries)).toBe(true);
    await app.close();
  });

  it('GET /api/env/browse requires admin', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await viewerKey(db);

    const res = await app.inject({
      method: 'GET',
      url: '/api/env/browse?host=controlPlane',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('PUT /api/env rejects invalid bool', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'RXWF_SMTP_SECURE', value: 'yes-please' }],
      },
    });
    expect(putRes.statusCode).toBe(400);
    await app.close();
  });

  it('PUT /api/env normalizes bool yes→true', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'RXWF_SMTP_SECURE', value: 'yes' }],
      },
    });
    expect(putRes.statusCode).toBe(200);
    const putBody = putRes.json() as {
      items: Array<{ key: string; value: string }>;
    };
    expect(putBody.items.find((i) => i.key === 'RXWF_SMTP_SECURE')?.value).toBe(
      'true',
    );
    await app.close();
  });

  it('PUT /api/env updates RXWF_PUBLIC_URL for admin', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'RXWF_PUBLIC_URL', value: 'https://example.test' }],
      },
    });
    expect(putRes.statusCode).toBe(200);
    const putBody = putRes.json() as {
      items: Array<{ key: string; value: string }>;
    };
    expect(putBody.items.find((i) => i.key === 'RXWF_PUBLIC_URL')?.value).toBe(
      'https://example.test',
    );

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/env',
      headers: { 'x-api-key': key },
    });
    const getBody = getRes.json() as {
      items: Array<{ key: string; value: string }>;
    };
    expect(getBody.items.find((i) => i.key === 'RXWF_PUBLIC_URL')?.value).toBe(
      'https://example.test',
    );

    await app.close();
  });

  it('PUT rejects unknown keys', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'API_URL', value: 'https://example.test' }],
      },
    });
    expect(putRes.statusCode).toBe(400);

    await app.close();
  });

  it('non-admin cannot PUT', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await viewerKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'RXWF_PUBLIC_URL', value: 'https://blocked.test' }],
      },
    });
    expect(putRes.statusCode).toBe(403);

    await app.close();
  });
});
