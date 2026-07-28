/**
 * P1 n8n-first UI/API gates: env CRUD, global executions, version rollback.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createLiteWorkflowRepository } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { buildApp } from '../app.js';

describe('P1 n8n-first API gates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;
  let workflowId: string;

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
      email: 'p1@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'p1')).key;

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'P1 Rollback',
      definition: {
        schemaVersion: 1,
        name: 'P1 Rollback',
        nodes: [
          {
            id: 't1',
            type: 'manualtrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [],
      },
    });
    workflowId = created.id;
    await workflows.update(workflowId, {
      schemaVersion: 1,
      name: 'P1 Rollback v2',
      nodes: [
        {
          id: 't1',
          type: 'manualtrigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: { json: { v: 2 } },
        },
      ],
      connections: [],
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('env CRUD for global test scope', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/env',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        items: [
          {
            key: 'P1_KEY',
            value: 'hello',
            testEnabled: true,
            prodEnabled: false,
          },
        ],
      },
    });
    expect(put.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/api/env',
      headers: { 'x-api-key': apiKey },
    });
    expect(list.statusCode).toBe(200);
    const json = list.json() as {
      items: Array<{ key: string; value: string; testEnabled: boolean }>;
    };
    expect(json.items.some((i) => i.key === 'P1_KEY' && i.value === 'hello' && i.testEnabled)).toBe(
      true,
    );
  });

  it('GET /api/executions returns global list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/executions?limit=10',
      headers: { 'x-api-key': apiKey },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { items: unknown[]; total: number };
    expect(Array.isArray(json.items)).toBe(true);
    expect(typeof json.total).toBe('number');
  });

  it('restore-draft loads historical published definition into editor draft', async () => {
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflowId}/publish`,
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: { publishNote: 'initial' },
    });
    expect(publishRes.statusCode).toBe(200);

    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflowId}`,
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: {
        definition: {
          schemaVersion: 1,
          name: 'P1 Changed Draft',
          nodes: [
            {
              id: 't1',
              type: 'manualtrigger',
              name: 'Start',
              position: { x: 0, y: 0 },
              parameters: { json: { v: 99 } },
            },
          ],
          connections: [],
        },
      },
    });

    const restore = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflowId}/published-versions/1/restore-draft`,
      headers: { 'x-api-key': apiKey },
    });
    expect(restore.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/api/workflows/${workflowId}`,
      headers: { 'x-api-key': apiKey },
    });
    const wf = get.json() as { workflow: { definition: { name: string } } };
    expect(wf.workflow.definition.name).toBe('P1 Rollback v2');
  });

  it('system features exposes publicUrl', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/system/features' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { publicUrl: string };
    expect(json.publicUrl).toBeTruthy();
  });
});
