import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createWorkflowService, type WorkflowDefinition } from '@rxwf/workflow';
import { createLiteWorkflowRepository } from '@rxwf/providers-lite';

const def: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'List Test',
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
};

describe('GET /api/executions', () => {
  it('returns paginated global execution list', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: `exec-list-${crypto.randomUUID()}@example.com`,
      password: 'secret1234',
      role: 'admin',
    });
    const { key } = await auth.createApiKey(user.id, 'test');

    const wf = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await wf.create({ name: 'List Test', definition: def });

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${created.id}/executions`,
      headers: { 'x-api-key': key },
      payload: { mode: 'manual', environment: 'test' },
    });
    expect(runRes.statusCode).toBe(202);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/executions?limit=50',
      headers: { 'x-api-key': key },
    });
    expect(listRes.statusCode).toBe(200);
    const body = listRes.json() as {
      items: Array<{ workflowName: string; workflowId: string }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0]?.workflowName).toBe('List Test');
    expect(body.items[0]?.workflowId).toBe(created.id);
    await app.close();
  });
});
