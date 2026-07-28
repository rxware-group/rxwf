import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { createTestDb } from '@rxwf/providers-lite';
import { createLiteWorkflowRepository } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { buildApp } from '../app.js';
import { createUserService } from '@rxwf/identity';

const NODE_SECRET = 'workflow-node-secret';

function sign(body: string): string {
  return createHmac('sha256', NODE_SECRET).update(body).digest('hex');
}

describe('Webhook routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let workflowId: string;
  let draftWorkflowId: string;
  let workflows: ReturnType<typeof createWorkflowService>;
  let publishUserId: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    workflows = createWorkflowService(createLiteWorkflowRepository(db));
    publishUserId = (await createUserService(db).createUser({ email: `wh-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const created = await workflows.create({
      name: 'Webhook Flow',
      definition: {
        schemaVersion: 1,
        name: 'Webhook Flow',
        nodes: [
          {
            id: 'wh-1',
            type: 'webhookTrigger',
            name: 'Hook',
            position: { x: 0, y: 0 },
            parameters: { path: 'orders', hmacSecret: NODE_SECRET },
          },
        ],
        connections: [],
      },
    });
    workflowId = created.id;
    await workflows.publish(workflowId, publishUserId);

    const draft = await workflows.create({
      name: 'Draft Webhook',
      definition: {
        schemaVersion: 1,
        name: 'Draft Webhook',
        nodes: [
          {
            id: 'wh-d',
            type: 'webhookTrigger',
            name: 'Hook',
            position: { x: 0, y: 0 },
            parameters: { path: 'draft', hmacSecret: NODE_SECRET },
          },
        ],
        connections: [],
      },
    });
    draftWorkflowId = draft.id;

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts signed prod webhook when published', async () => {
    const body = JSON.stringify({ orderId: '42' });
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/${workflowId}/orders`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': ts,
        'idempotency-key': 'webhook-test-key-1',
      },
      payload: { orderId: '42' },
    });
    expect(res.statusCode).toBe(202);
    const json = res.json() as { executionId: string; status: string };
    expect(json.executionId).toBeTruthy();
    expect(json.status).toBe('success');

    const dup = await app.inject({
      method: 'POST',
      url: `/webhook/${workflowId}/orders`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': ts,
        'idempotency-key': 'webhook-test-key-1',
      },
      payload: { orderId: '42' },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json()).toEqual(json);
  });

  it('rejects prod webhook when unpublished', async () => {
    const body = JSON.stringify({ x: 1 });
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/${draftWorkflowId}/draft`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      payload: { x: 1 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'E2001' });
  });

  it('accepts test webhook for draft workflow', async () => {
    const body = JSON.stringify({ test: true });
    const res = await app.inject({
      method: 'POST',
      url: `/webhook-test/${draftWorkflowId}/draft`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': String(Math.floor(Date.now() / 1000)),
        'idempotency-key': 'webhook-test-mode-1',
      },
      payload: { test: true },
    });
    expect(res.statusCode).toBe(202);
  });

  it('creates separate prod execution when test webhook used same idempotency key', async () => {
    const body = JSON.stringify({ shared: true });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(body);
    const sharedKey = `shared-key-${crypto.randomUUID()}`;
    const headers = {
      'x-rxwf-signature': sig,
      'x-rxwf-timestamp': ts,
      'idempotency-key': sharedKey,
    };

    const testRes = await app.inject({
      method: 'POST',
      url: `/webhook-test/${workflowId}/orders`,
      headers,
      payload: { shared: true },
    });
    expect(testRes.statusCode).toBe(202);
    const testJson = testRes.json() as { executionId: string };

    const prodRes = await app.inject({
      method: 'POST',
      url: `/webhook/${workflowId}/orders`,
      headers,
      payload: { shared: true },
    });
    expect(prodRes.statusCode).toBe(202);
    const prodJson = prodRes.json() as { executionId: string };
    expect(prodJson.executionId).not.toBe(testJson.executionId);
  });

  it('rejects invalid signature with E2005', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/${workflowId}/orders`,
      headers: {
        'x-rxwf-signature': 'deadbeef',
        'x-rxwf-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'E2005' });
  });

  it('rejects apiKeyHmac when credentials are not configured (E2005)', async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    const localWorkflows = createWorkflowService(createLiteWorkflowRepository(db));
    const localPublishUserId = (await createUserService(db).createUser({ email: `wh-local-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const noSecret = await localWorkflows.create({
      name: 'No Secret',
      definition: {
        schemaVersion: 1,
        name: 'No Secret',
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'Hook',
            position: { x: 0, y: 0 },
            parameters: { path: 'open', authMode: 'apiKeyHmac' },
          },
        ],
        connections: [],
      },
    });
    await localWorkflows.publish(noSecret.id, localPublishUserId);
    await built.app.ready();
    const body = '{}';
    const res = await built.app.inject({
      method: 'POST',
      url: `/webhook/${noSecret.id}/open`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'E2005' });
    await built.app.close();
  });

  it('accepts none auth without credentials', async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    const localWorkflows = createWorkflowService(createLiteWorkflowRepository(db));
    const localPublishUserId = (await createUserService(db).createUser({ email: `wh-open-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const open = await localWorkflows.create({
      name: 'Open Webhook',
      definition: {
        schemaVersion: 1,
        name: 'Open Webhook',
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'Hook',
            position: { x: 0, y: 0 },
            parameters: { path: 'public', authMode: 'none' },
          },
        ],
        connections: [],
      },
    });
    await localWorkflows.publish(open.id, localPublishUserId);
    await built.app.ready();
    const res = await built.app.inject({
      method: 'POST',
      url: `/webhook/${open.id}/public`,
      payload: { hello: true },
    });
    expect(res.statusCode).toBe(202);
    await built.app.close();
  });

  it('accepts apiKey auth with matching header', async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    const localWorkflows = createWorkflowService(createLiteWorkflowRepository(db));
    const localPublishUserId = (await createUserService(db).createUser({ email: `wh-key-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const apiKey = 'test-api-key-123';
    const keyed = await localWorkflows.create({
      name: 'API Key Webhook',
      definition: {
        schemaVersion: 1,
        name: 'API Key Webhook',
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'Hook',
            position: { x: 0, y: 0 },
            parameters: { path: 'keyed', authMode: 'apiKey', apiKey },
          },
        ],
        connections: [],
      },
    });
    await localWorkflows.publish(keyed.id, localPublishUserId);
    await built.app.ready();
    const res = await built.app.inject({
      method: 'POST',
      url: `/webhook/${keyed.id}/keyed`,
      headers: { 'x-rxwf-api-key': apiKey },
      payload: { ok: true },
    });
    expect(res.statusCode).toBe(202);
    await built.app.close();
  });

  it('rejects expired timestamp with E2006', async () => {
    const body = JSON.stringify({ x: 1 });
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    const res = await app.inject({
      method: 'POST',
      url: `/webhook/${workflowId}/orders`,
      headers: {
        'x-rxwf-signature': sign(body),
        'x-rxwf-timestamp': stale,
      },
      payload: { x: 1 },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'E2006' });
  });
});
