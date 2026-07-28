import { createHash } from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteRunnerRepository,
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createExecutionRuntime, definitionFromSnapshot } from './create-execution-runtime.js';
import { runnerGateway } from '../runners/gateway-instance.js';
import type { createInMemoryRunnerGateway } from '../runners/runner-gateway.js';

const nodeRunsTable = liteSchema.nodeRuns;

function hashCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex');
}

type GatewayWithHandler = ReturnType<typeof createInMemoryRunnerGateway>;

function gatewayWithHandler(): GatewayWithHandler {
  return runnerGateway as GatewayWithHandler;
}

async function registerOnlineAgent(db: Awaited<ReturnType<typeof createTestDb>>) {
  const repo = createLiteRunnerRepository(db);
  const agent = await repo.registerAgent(
    {
      name: 'remote-agent',
      platform: { os: 'linux', arch: 'x64' },
      capabilities: ['code', 'shell', 'http'],
      maxConcurrent: 4,
      agentVersion: '1.0.0',
    },
    hashCredential('test-credential'),
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
          outputItems: [[{ json: { stdout: 'remote-ok', stderr: '', exitCode: 0 } }]],
          durationMs: 5,
        },
      });
    },
    close: () => {},
  });

  return agent;
}

describe('runner remote execution integration', () => {
  const connectedAgentIds: string[] = [];

  afterEach(() => {
    for (const id of connectedAgentIds) {
      runnerGateway.unregisterConnection(id);
    }
    connectedAgentIds.length = 0;
  });

  it('executeCommand with pinned agent policy persists agent runner_id', async () => {
    const db = await createTestDb();
    const agent = await registerOnlineAgent(db);
    connectedAgentIds.push(agent.id);

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Remote command',
      definition: {
        schemaVersion: 1,
        name: 'Remote command',
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
            id: 'cmd-1',
            type: 'executeCommand',
            name: 'Run',
            position: { x: 100, y: 0 },
            parameters: { command: 'echo ok' },
          },
        ],
        connections: [{ from: 't1', to: 'cmd-1' }],
      },
    });
    const runtime = await createExecutionRuntime(db);
    const enqueued = await runtime.enqueueService.enqueue({
      workflowId: created.id,
      triggerType: 'manual',
      mode: 'manual',
    });
    const stored = await runtime.executionRepo.getExecution(enqueued.executionId);
    expect(stored).toBeTruthy();
    const definition = definitionFromSnapshot(stored!.definitionSnapshot);
    await runtime.runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: 'manual',
      workflowId: created.id,
    });

    const cmdRun = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'cmd-1'));
    expect(cmdRun).toHaveLength(1);
    expect(cmdRun[0]?.runnerId).toBe(agent.id);
    expect(cmdRun[0]?.status).toBe('success');
  });

  it('httpRequest with pinned agent policy persists agent runner_id', async () => {
    const db = await createTestDb();
    const agent = await registerOnlineAgent(db);
    connectedAgentIds.push(agent.id);

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'HTTP remote',
      definition: {
        schemaVersion: 1,
        name: 'HTTP remote',
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
            id: 'http-1',
            type: 'httpRequest',
            name: 'Fetch',
            position: { x: 100, y: 0 },
            parameters: {
              url: 'https://example.com',
              method: 'GET',
              responseFormat: 'text',
            },
          },
        ],
        connections: [{ from: 't1', to: 'http-1' }],
      },
    });
    const runtime = await createExecutionRuntime(db);
    const enqueued = await runtime.enqueueService.enqueue({
      workflowId: created.id,
      triggerType: 'manual',
      mode: 'manual',
    });
    const stored = await runtime.executionRepo.getExecution(enqueued.executionId);
    expect(stored).toBeTruthy();
    const definition = definitionFromSnapshot(stored!.definitionSnapshot);
    await runtime.runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: 'manual',
      workflowId: created.id,
    });

    const httpRun = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'http-1'));
    expect(httpRun).toHaveLength(1);
    expect(httpRun[0]?.runnerId).toBe(agent.id);
    expect(httpRun[0]?.status).toBe('success');
  });
});
