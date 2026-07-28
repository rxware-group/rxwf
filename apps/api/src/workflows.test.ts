import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from './app.js';

const definition = {
  schemaVersion: 1 as const,
  name: 'API Demo',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'Start',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

describe('workflow routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'flows@example.com',
      password: 'secret',
      role: 'admin',
    });
    const keyRecord = await auth.createApiKey(user.id, 'test');
    apiKey = keyRecord.key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates and lists workflows', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Flow A', definition },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };
    expect(created.id).toBeTruthy();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/workflows',
      headers: { 'x-api-key': apiKey },
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { workflows: Array<{ id: string }> };
    expect(list.workflows.some((w) => w.id === created.id)).toBe(true);
  });

  it('auto-save updates draft and publish history supports rollback and restore', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Versioned', definition },
    });
    const { id } = createRes.json() as { id: string };

    const v2Def = { ...definition, name: 'Versioned v2' };
    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${id}`,
      headers: { 'x-api-key': apiKey },
      payload: { definition: v2Def },
    });

    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${id}/publish`,
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: { publishNote: 'first publish' },
    });
    expect(publishRes.statusCode).toBe(200);

    const versionsRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${id}/published-versions`,
      headers: { 'x-api-key': apiKey },
    });
    expect(versionsRes.statusCode).toBe(200);
    const { versions } = versionsRes.json() as {
      versions: Array<{ version: number; publishNote?: string; isCurrent: boolean }>;
    };
    expect(versions).toHaveLength(1);
    expect(versions[0]?.publishNote).toBe('first publish');
    expect(versions[0]?.isCurrent).toBe(true);

    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${id}`,
      headers: { 'x-api-key': apiKey },
      payload: { definition: { ...definition, name: 'Versioned v3 draft' } },
    });

    await app.inject({
      method: 'POST',
      url: `/api/workflows/${id}/publish`,
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: { publishNote: 'second publish' },
    });

    const rollbackRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${id}/published-versions/1/rollback`,
      headers: { 'x-api-key': apiKey },
    });
    expect(rollbackRes.statusCode).toBe(200);

    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${id}/published-versions/1/restore-draft`,
      headers: { 'x-api-key': apiKey },
    });
    expect(restoreRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${id}`,
      headers: { 'x-api-key': apiKey },
    });
    const { workflow } = getRes.json() as { workflow: { definition: { name: string } } };
    expect(workflow.definition.name).toBe('Versioned v2');
  });
});
