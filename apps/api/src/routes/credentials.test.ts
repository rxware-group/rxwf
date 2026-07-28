import { describe, it, expect } from 'vitest';
import {
  createLiteCredentialRepository,
  createTestDb,
} from '@rxwf/providers-lite';
import {
  encryptCredentialPayload,
  parseCredentialKey,
} from '@rxwf/credential';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';
import { config } from '../config.js';

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `cred-${crypto.randomUUID()}@example.com`,
    password: 'secret',
    role: 'admin',
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return key;
}

describe('credential routes', () => {
  it('creates and lists credentials without secret fields', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'gitlab',
        type: 'apiKey',
        data: { apiKey: 'abc' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string; name: string; type: string };
    expect(created.name).toBe('gitlab');
    expect(created).not.toHaveProperty('data');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { id: string }[];
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);

    const testRes = await app.inject({
      method: 'POST',
      url: `/api/credentials/${created.id}/test`,
      headers: { 'x-api-key': key },
    });
    expect(testRes.statusCode).toBe(200);
    expect(testRes.json()).toEqual({ ok: true });
    await app.close();
  });

  it('GET /api/credentials/types returns 4 generic type ids', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'GET',
      url: '/api/credentials/types',
      headers: { 'x-api-key': key },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { types: Array<{ id: string }> };
    expect(body.types.map((t) => t.id).sort()).toEqual([
      'apiKey',
      'basicAuth',
      'httpHeaderAuth',
      'oauth2Manual',
    ]);
    await app.close();
  });

  it('POST unknown type returns 400', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'bad',
        type: 'gitlabApi',
        data: { token: 'abc' },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'E1001',
      message: expect.stringContaining('Unknown credential type'),
    });
    await app.close();
  });

  it('POST credential stores encrypted data not plaintext secrets', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);
    const secret = 'plaintext-secret-value';

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'encrypted-check',
        type: 'apiKey',
        data: { apiKey: secret },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };

    const row = await createLiteCredentialRepository(db).findById(created.id);
    expect(row).not.toBeNull();
    expect(row!.dataEncrypted).not.toContain(secret);
    expect(row!.dataEncrypted).not.toContain('"apiKey"');
    await app.close();
  });

  it('DELETE /api/credentials/:credentialId removes credential', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'to-delete',
        type: 'apiKey',
        data: { apiKey: 'delete-me' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/credentials/${created.id}`,
      headers: { 'x-api-key': key },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
    });
    expect(listRes.json()).toEqual([]);
    await app.close();
  });

  it('POST /api/credentials/:credentialId/apply-auth returns auth headers', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'auth-headers',
        type: 'apiKey',
        data: { apiKey: 'sk-test', prefix: 'Bearer' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };

    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/credentials/${created.id}/apply-auth`,
      headers: { 'x-api-key': key },
    });
    expect(applyRes.statusCode).toBe(200);
    expect(applyRes.json()).toEqual({
      headers: { Authorization: 'Bearer sk-test' },
    });
    await app.close();
  });

  it('POST apply-auth rejects credential that injects no headers', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);
    const repo = createLiteCredentialRepository(db);
    const credId = crypto.randomUUID();
    const encryptionKey = parseCredentialKey(config.credentialKey);
    await repo.insert({
      id: credId,
      name: 'empty-auth',
      type: 'apiKey',
      dataEncrypted: encryptCredentialPayload(
        JSON.stringify({ apiKey: '', headerName: 'Authorization', prefix: '' }),
        encryptionKey,
      ),
    });

    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/credentials/${credId}/apply-auth`,
      headers: { 'x-api-key': key },
    });
    expect(applyRes.statusCode).toBe(400);
    expect(applyRes.json()).toMatchObject({
      code: 'E1001',
      message: expect.stringMatching(/no auth headers/i),
    });
    await app.close();
  });

  it('POST apiKey missing apiKey field returns 400', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const res = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': key },
      payload: {
        name: 'missing-key',
        type: 'apiKey',
        data: { headerName: 'Authorization' },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'E1001',
      message: expect.stringContaining('Missing required field: apiKey'),
    });
    await app.close();
  });
});
