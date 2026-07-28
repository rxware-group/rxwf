import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `vars-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role: 'admin',
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return key;
}

describe('variables routes', () => {
  it('GET /api/variables returns grouped global items', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'GET',
      url: '/api/variables',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ items: [] });
    await app.close();
  });

  it('PUT /api/variables syncs test and prod for same key', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/variables',
      headers: { 'x-api-key': key },
      payload: {
        items: [
          {
            key: 'API_BASE',
            value: 'https://example.test',
            testEnabled: true,
            prodEnabled: true,
          },
        ],
      },
    });
    expect(putRes.statusCode).toBe(200);
    const putBody = putRes.json() as {
      items: Array<{ key: string; testEnabled: boolean; prodEnabled: boolean }>;
    };
    expect(putBody.items[0]?.key).toBe('API_BASE');
    expect(putBody.items[0]?.testEnabled).toBe(true);
    expect(putBody.items[0]?.prodEnabled).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/variables',
      headers: { 'x-api-key': key },
    });
    const getBody = getRes.json() as {
      items: Array<{ key: string; value: string; testId?: string; prodId?: string }>;
    };
    expect(getBody.items).toHaveLength(1);
    expect(getBody.items[0]?.value).toBe('https://example.test');
    expect(getBody.items[0]?.testId).toBeTruthy();
    expect(getBody.items[0]?.prodId).toBeTruthy();

    await app.close();
  });

  it('DELETE /api/variables/:id removes row', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/variables',
      headers: { 'x-api-key': key },
      payload: {
        items: [{ key: 'X', value: '1', testEnabled: true, prodEnabled: false }],
      },
    });
    const testId = (putRes.json() as { items: Array<{ testId?: string }> }).items[0]!
      .testId!;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/variables/${testId}`,
      headers: { 'x-api-key': key },
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/variables',
      headers: { 'x-api-key': key },
    });
    expect((getRes.json() as { items: unknown[] }).items).toHaveLength(0);
    await app.close();
  });
});
