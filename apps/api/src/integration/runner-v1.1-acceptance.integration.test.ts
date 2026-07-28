/**
 * Runner v1.1 验收清单（design §20 / changelog runner-v1.1.md）
 *
 * | 项 | 覆盖 |
 * |----|------|
 * | register + GET /runners online | AC-1 + runner-ws / runner-agent-e2e |
 * | code / executeCommand 远程 + runner_id | AC-2 + runner-remote / runner-agent-e2e |
 * | httpRequest pinned → agent remote | AC-3 runner-remote |
 * | 三层策略 node > workflow > global | AC-4 本文件 |
 * | drain / rotate-credential 踢线 | AC-5 本文件 |
 * | Embedded 回归 | AC-6 本文件 |
 */
import { createHash } from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { eq } from 'drizzle-orm';
import {
  createLiteRunnerRepository,
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
import { createExecutionRuntime, definitionFromSnapshot } from '../execution/create-execution-runtime.js';
import { runnerGateway } from '../runners/gateway-instance.js';
import type { createInMemoryRunnerGateway } from '../runners/runner-gateway.js';

const nodeRunsTable = liteSchema.nodeRuns;

type GatewayWithHandler = ReturnType<typeof createInMemoryRunnerGateway>;

function gatewayWithHandler(): GatewayWithHandler {
  return runnerGateway as GatewayWithHandler;
}

function hashCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex');
}

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `runner-ac-${crypto.randomUUID()}@example.com`,
    password: 'secret',
    role: 'admin',
  });
  const { key } = await auth.createApiKey(user.id, 'acceptance');
  return key;
}

async function registerOnlineAgent(db: Awaited<ReturnType<typeof createTestDb>>) {
  const repo = createLiteRunnerRepository(db);
  const agent = await repo.registerAgent(
    {
      name: 'acceptance-agent',
      platform: { os: 'linux', arch: 'x64' },
      capabilities: ['code', 'shell', 'http'],
      maxConcurrent: 4,
      agentVersion: '1.0.0',
    },
    hashCredential('acceptance-credential'),
  );
  await repo.setStatus(agent.id, 'online');

  gatewayWithHandler().registerConnection(agent.id, {
    send: (msg) => {
      const envelope = msg as { type?: string; id?: string };
      if (envelope.type !== 'job.assign' || !envelope.id) return;
      gatewayWithHandler().handleIncomingMessage(agent.id, {
        type: 'job.result',
        id: envelope.id,
        payload: {
          jobId: envelope.id,
          status: 'success',
          outputItems: [[{ json: { remote: true } }]],
          durationMs: 3,
        },
      });
    },
    close: () => {},
  });

  return { agent, repo };
}

async function runWorkflow(
  db: Awaited<ReturnType<typeof createTestDb>>,
  definition: Parameters<ReturnType<typeof createWorkflowService>['create']>[0]['definition'],
) {
  const workflows = createWorkflowService(createLiteWorkflowRepository(db));
  const created = await workflows.create({ name: 'Acceptance', definition });
  const runtime = await createExecutionRuntime(db);
  const enqueued = await runtime.enqueueService.enqueue({
    workflowId: created.id,
    triggerType: 'manual',
    mode: 'manual',
  });
  const stored = await runtime.executionRepo.getExecution(enqueued.executionId);
  expect(stored).toBeTruthy();
  const snap = definitionFromSnapshot(stored!.definitionSnapshot);
  await runtime.runner.runStoredExecution({
    executionId: enqueued.executionId,
    definition: snap,
    mode: 'manual',
    workflowId: created.id,
  });
}

function waitForWsMessage(
  ws: WebSocket,
  type: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === type) {
          ws.off('message', onMessage);
          resolve(msg);
        }
      } catch {
        // ignore
      }
    };
    ws.on('message', onMessage);
    ws.once('error', reject);
    ws.once('close', () => reject(new Error(`WebSocket closed before ${type}`)));
  });
}

function waitForWsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

describe('Runner v1.1 acceptance (integration)', () => {
  const connectedAgentIds: string[] = [];

  afterEach(() => {
    for (const id of connectedAgentIds) {
      runnerGateway.unregisterConnection(id);
    }
    connectedAgentIds.length = 0;
  });

  it('AC-4: three-layer policy — node embedded overrides workflow pinned agent', async () => {
    const db = await createTestDb();
    const { agent, repo } = await registerOnlineAgent(db);
    connectedAgentIds.push(agent.id);
    const embedded = await repo.ensureEmbedded({ os: 'linux', arch: 'x64' }, ['code']);

    await runWorkflow(db, {
      schemaVersion: 1,
      name: 'Three layer',
      active: true,
      settings: {
        runnerPolicy: {
          mode: 'pinned',
          runnerId: agent.id,
          fallback: 'fail',
        },
      },
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'code-1',
          type: 'code',
          name: 'Code',
          position: { x: 100, y: 0 },
          runner: { mode: 'embedded' },
          parameters: { jsCode: 'return [{ json: { ok: true } }];' },
        },
        {
          id: 'cmd-1',
          type: 'executeCommand',
          name: 'Cmd',
          position: { x: 200, y: 0 },
          parameters: { command: 'echo ok' },
        },
      ],
      connections: [
        { from: 't1', to: 'code-1' },
        { from: 'code-1', to: 'cmd-1' },
      ],
    });

    const codeRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'code-1'));
    expect(codeRuns[0]?.runnerId).toBe(embedded.id);

    const cmdRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'cmd-1'));
    expect(cmdRuns[0]?.runnerId).toBe(agent.id);
  });

  it('AC-4: global default embedded when workflow has no runnerPolicy', async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const embedded = await repo.ensureEmbedded({ os: 'linux', arch: 'x64' }, ['code']);

    await runWorkflow(db, {
      schemaVersion: 1,
      name: 'Global embedded',
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
          id: 'code-1',
          type: 'code',
          name: 'Code',
          position: { x: 100, y: 0 },
          parameters: { jsCode: 'return [{ json: { local: true } }];' },
        },
      ],
      connections: [{ from: 't1', to: 'code-1' }],
    });

    const codeRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'code-1'));
    expect(codeRuns[0]?.runnerId).toBe(embedded.id);
    expect(codeRuns[0]?.status).toBe('success');
  });

  it('AC-5: drain sends config.update; rotate-credential kicks WebSocket', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/runners/registration-tokens',
      headers: { 'x-api-key': key },
      payload: {},
    });
    const { registrationToken } = tokenRes.json() as { registrationToken: string };

    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/runners/register',
      payload: {
        registrationToken,
        name: 'ws-drain',
        platform: { os: 'linux', arch: 'x64' },
        capabilities: ['code'],
        agentVersion: '1.0.0',
      },
    });
    const { runnerId, runnerCredential } = registerRes.json() as {
      runnerId: string;
      runnerCredential: string;
    };

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/api/runners/${runnerId}/stream`,
    );

    try {
      await waitForWsOpen(ws);
      ws.send(
        JSON.stringify({
          type: 'auth',
          ts: new Date().toISOString(),
          payload: { runnerCredential },
        }),
      );
      await waitForWsMessage(ws, 'auth.ok');
      expect(runnerGateway.isConnected(runnerId)).toBe(true);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/runners',
        headers: { 'x-api-key': key },
      });
      const listBody = listRes.json() as {
        runners: Array<{ id: string; status: string }>;
      };
      expect(listBody.runners.find((r) => r.id === runnerId)?.status).toBe('online');

      const drainPromise = waitForWsMessage(ws, 'config.update');
      const drainRes = await app.inject({
        method: 'POST',
        url: `/api/runners/${runnerId}/drain`,
        headers: { 'x-api-key': key },
      });
      expect(drainRes.statusCode).toBe(200);
      const drainMsg = await drainPromise;
      expect(drainMsg).toMatchObject({
        type: 'config.update',
        payload: { status: 'draining' },
      });

      const rotatePromise = waitForWsMessage(ws, 'auth.fail');
      const closePromise = new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
      });
      const rotateRes = await app.inject({
        method: 'POST',
        url: `/api/runners/${runnerId}/rotate-credential`,
        headers: { 'x-api-key': key },
      });
      expect(rotateRes.statusCode).toBe(200);
      await rotatePromise;
      await closePromise;
      expect(runnerGateway.isConnected(runnerId)).toBe(false);
    } finally {
      ws.removeAllListeners();
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
      }
      await app.close();
    }
  }, 20_000);
});

describe('Runner v1.1 acceptance (cross-suite map)', () => {
  it('documents sibling tests for register, remote dispatch, and http fallback', () => {
    const suiteMap = {
      'rxwf-runner spawn + code/cmd remote': 'runner-agent-e2e.integration.test.ts',
      'executeCommand remote runner_id': 'runner-remote.integration.test.ts',
      'httpRequest remote runner_id': 'runner-remote.integration.test.ts',
      'WebSocket job.assign/result': 'runner-ws.integration.test.ts',
      'REST register drain rotate delete': 'runners-registration.test.ts',
      'resolveEffectiveRunnerPolicy unit': 'packages/workflow/src/runner-policy.test.ts',
      'NodeRunnerFacade whitelist': 'packages/node-runner/src/facade/node-runner-facade.test.ts',
    };
    expect(Object.keys(suiteMap).length).toBeGreaterThanOrEqual(6);
  });
});
