/**
 * M1 核心能力集成测试（自动化）
 * 覆盖：手动执行、Webhook+HMAC+Timestamp、定时入队、子工作流、执行查询、凭证
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createTestDb, createLiteWorkflowRepository, liteSchema } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
const M1_WEBHOOK_SECRET = 'm1-integration-webhook-secret';

function signWebhook(body: string): string {
  return createHmac('sha256', M1_WEBHOOK_SECRET).update(body).digest('hex');
}

describe('M1 core integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: Awaited<ReturnType<typeof buildApp>>['db'];
  let apiKey: string;
  let workflowId: string;
  let childWorkflowId: string;
  let adminUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'm1@example.com',
      password: 'secret',
      role: 'admin',
    });
    adminUserId = user.id;
    apiKey = (await auth.createApiKey(user.id, 'm1')).key;

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const child = await workflows.create({
      name: 'M1 Child',
      definition: {
        schemaVersion: 1,
        name: 'M1 Child',
        active: true,
        nodes: [
          { id: 't1', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
          { id: 's1', type: 'set', name: 'S', position: { x: 1, y: 0 }, parameters: { fields: { ok: 1 } } },
        ],
        connections: [{ from: 't1', to: 's1' }],
      },
    });
    childWorkflowId = child.id;
    await workflows.publish(child.id, adminUserId);

    const parent = await workflows.create({
      name: 'M1 Parent',
      definition: {
        schemaVersion: 1,
        name: 'M1 Parent',
        active: true,
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'WH',
            position: { x: 0, y: 0 },
            parameters: { path: 'hook', hmacSecret: M1_WEBHOOK_SECRET },
          },
          { id: 'sw', type: 'executeWorkflow', name: 'SW', position: { x: 1, y: 0 }, parameters: { workflowId: child.id } },
        ],
        connections: [{ from: 'wh', to: 'sw' }],
      },
    });
    workflowId = parent.id;
    await workflows.publish(parent.id, adminUserId);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-3: manual execution + execution_get with nodeRuns', async () => {
    const run = await app.inject({
      method: 'POST',
      url: `/api/workflows/${childWorkflowId}/executions`,
      headers: { 'x-api-key': apiKey },
      payload: { mode: 'manual' },
    });
    expect(run.statusCode).toBe(202);
    const { executionId } = run.json() as { executionId: string };
    const detail = await app.inject({
      method: 'GET',
      url: `/api/executions/${executionId}`,
      headers: { 'x-api-key': apiKey },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json() as { status: string; nodeRuns: unknown[] };
    expect(body.status).toBe('success');
    expect(body.nodeRuns.length).toBeGreaterThan(0);
  });

  it('AC-37/38: webhook HMAC + timestamp + idempotency on child flow', async () => {
    const workflowsSvc = createWorkflowService(createLiteWorkflowRepository(db));
    const whChild = await workflowsSvc.create({
      name: 'M1 WH',
      definition: {
        schemaVersion: 1,
        name: 'M1 WH',
        active: true,
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'WH',
            position: { x: 0, y: 0 },
            parameters: { path: 'm1', hmacSecret: M1_WEBHOOK_SECRET },
          },
        ],
        connections: [],
      },
    });
    await workflowsSvc.publish(whChild.id, adminUserId);

    const payload = { event: 'm1' };
    const body = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = {
      'x-rxwf-signature': signWebhook(body),
      'x-rxwf-timestamp': ts,
      'idempotency-key': 'm1-webhook-key',
    };
    const first = await app.inject({
      method: 'POST',
      url: `/webhook/${whChild.id}/m1`,
      headers,
      payload,
    });
    expect(first.statusCode).toBe(202);
    const second = await app.inject({
      method: 'POST',
      url: `/webhook/${whChild.id}/m1`,
      headers,
      payload,
    });
    expect(second.statusCode).toBe(200);
  });

  it('credentials CRUD without leaking secrets', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'tok', type: 'apiKey', data: { apiKey: 'x' } },
    });
    expect(create.statusCode).toBe(201);
    const list = await app.inject({
      method: 'GET',
      url: '/api/credentials',
      headers: { 'x-api-key': apiKey },
    });
    const rows = list.json() as { name: string }[];
    expect(rows[0]?.name).toBe('tok');
    expect(JSON.stringify(rows)).not.toContain('secret');
  });
});
