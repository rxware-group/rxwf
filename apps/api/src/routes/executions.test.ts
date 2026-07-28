import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createWorkflowService } from '@rxwf/workflow';
import { createLiteWorkflowRepository, createTestDb } from '@rxwf/providers-lite';

describe('execution query routes', () => {
  async function apiKeyHeaders(db: Awaited<ReturnType<typeof buildApp>>['db']) {
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'exec@example.com',
      password: 'secret',
      role: 'admin',
    });
    const { key } = await auth.createApiKey(user.id, 'test');
    return { 'x-api-key': key };
  }

  it('lists executions and returns detail with node run timeline', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const headers = await apiKeyHeaders(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'List',
      definition: {
        schemaVersion: 1,
        name: 'List',
        active: true,
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
      },
    });

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${created.id}/executions`,
      headers,
      payload: { mode: 'manual' },
    });
    expect(runRes.statusCode).toBe(202);
    const { executionId } = runRes.json() as { executionId: string };

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${created.id}/executions?limit=50`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { items: { id: string }[]; total: number };
    expect(listBody.total).toBe(1);
    expect(listBody.items[0]?.id).toBe(executionId);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}`,
      headers,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json() as {
      status: string;
      nodeRuns: { nodeId: string; runnerPlatform?: { os: string } }[];
    };
    expect(detail.status).toBe('success');
    expect(detail.nodeRuns).toHaveLength(1);
    expect(detail.nodeRuns[0]?.nodeId).toBe('t1');
    expect(detail.nodeRuns[0]?.runnerPlatform?.os).toBeTruthy();
    await app.close();
  });

  it('persists code node logs in node run metadata', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const headers = await apiKeyHeaders(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Code logs',
      definition: {
        schemaVersion: 1,
        name: 'Code logs',
        active: true,
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'c1',
            type: 'code',
            name: 'Code',
            position: { x: 220, y: 0 },
            parameters: {
              jsCode: '$log.info("hello from execution"); return [{ json: { ok: true } }];',
            },
          },
        ],
        connections: [{ from: 't1', to: 'c1' }],
      },
    });

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${created.id}/executions`,
      headers,
      payload: { mode: 'manual' },
    });
    expect(runRes.statusCode).toBe(202);
    const { executionId } = runRes.json() as { executionId: string };

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}`,
      headers,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json() as {
      status: string;
      nodeRuns: Array<{
        nodeId: string;
        metadata?: { logs?: Array<{ message: string }> };
      }>;
    };
    expect(detail.status).toBe('success');
    const codeRun = detail.nodeRuns.find((nr) => nr.nodeId === 'c1');
    expect(codeRun?.metadata?.logs?.length).toBeGreaterThan(0);
    expect(codeRun?.metadata?.logs?.some((l) => l.message.includes('hello'))).toBe(true);
    await app.close();
  });

  it('persists editor debug runs as partial executions', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const headers = await apiKeyHeaders(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const definition = {
      schemaVersion: 1,
      name: 'Debug partial',
      active: true,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'c1',
          type: 'code',
          name: 'Code',
          position: { x: 220, y: 0 },
          parameters: {
            jsCode: '$log.info("debug run"); return [{ json: { debug: true } }];',
          },
        },
      ],
      connections: [{ from: 't1', to: 'c1' }],
    };
    const created = await workflows.create({
      name: 'Debug partial',
      definition,
    });

    const debugRes = await app.inject({
      method: 'POST',
      url: '/api/workflows/debug-node',
      headers,
      payload: {
        definition,
        targetNodeId: 'c1',
        workflowId: created.id,
        environment: 'test',
      },
    });
    expect(debugRes.statusCode).toBe(200);
    const debugBody = debugRes.json() as {
      status: string;
      executionId?: string;
    };
    expect(debugBody.status).toBe('success');
    expect(debugBody.executionId).toBeTruthy();

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${created.id}/executions?limit=50`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as {
      items: Array<{ id: string; mode: string; status: string }>;
      total: number;
    };
    expect(listBody.total).toBe(1);
    expect(listBody.items[0]?.id).toBe(debugBody.executionId);
    expect(listBody.items[0]?.mode).toBe('partial');
    expect(listBody.items[0]?.status).toBe('success');

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/executions/${debugBody.executionId}`,
      headers,
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json() as {
      mode: string;
      status: string;
      definitionSnapshot: { nodes: Array<{ id: string }> };
      nodeRuns: Array<{
        nodeId: string;
        metadata?: { logs?: Array<{ message: string }> };
      }>;
    };
    expect(detail.mode).toBe('partial');
    expect(detail.status).toBe('success');
    expect(detail.definitionSnapshot.nodes.some((n) => n.id === 'c1')).toBe(true);
    expect(detail.nodeRuns.map((nr) => nr.nodeId).sort()).toEqual(['c1', 't1']);
    const codeRun = detail.nodeRuns.find((nr) => nr.nodeId === 'c1');
    expect(codeRun?.metadata?.logs?.some((l) => l.message.includes('debug run'))).toBe(true);
    await app.close();
  });
});
