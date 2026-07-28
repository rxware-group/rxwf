import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createExecutionRuntime } from '../execution/create-execution-runtime.js';
import { runHitlTimeoutSweepOnce } from '../execution/hitl-sweeper.js';

const jobsTable = liteSchema.jobs;
const executionsTable = liteSchema.executions;
const nodeRunsTable = liteSchema.nodeRuns;

function hitlWorkflowDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'HITL Test',
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'ap',
        type: 'humanApproval',
        name: 'Approve',
        position: { x: 200, y: 0 },
        parameters: {
          prompt: 'Approve deploy {{ $json.version }}?',
          allowReject: 'true',
          timeoutMs: 60_000,
          timeoutAction: 'reject',
        },
      },
      {
        id: 'set',
        type: 'set',
        name: 'After',
        position: { x: 400, y: 0 },
        parameters: { mode: 'manual', fields: { done: true } },
      },
    ],
    connections: [
      { from: 'tr', to: 'ap' },
      { from: 'ap', to: 'set' },
    ],
  };
}

describe('P4-B HITL integration (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let executionId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    runtime = await createExecutionRuntime(db, { os: 'linux', arch: 'x64' }, {});

    const created = await workflows.create({
      name: 'HITL Flow',
      definition: hitlWorkflowDefinition(),
    });
    workflowId = created.id;
  });

  async function enqueueManual() {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({
        workflowId,
        triggerType: 'manual',
        definitionSource: 'draft',
      }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('pauses at humanApproval with waiting status, then resumes on approve', async () => {
    await enqueueManual();

    const executions = await db.select().from(executionsTable);
    const exec = executions[executions.length - 1];
    expect(exec?.status).toBe('waiting');
    executionId = exec!.id;

    const waitingRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'ap'));
    expect(waitingRuns[waitingRuns.length - 1]?.status).toBe('waiting');

    const resumed = await runtime.resumeHitl({
      executionId,
      nodeId: 'ap',
      decision: 'approve',
      comment: 'ship it',
    });
    expect(resumed.status).toBe('success');

    const afterExec = await db
      .select()
      .from(executionsTable)
      .where(eq(executionsTable.id, executionId));
    expect(afterExec[0]?.status).toBe('success');

    const setRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'set'));
    expect(setRuns.length).toBeGreaterThan(0);
    expect(setRuns[setRuns.length - 1]?.status).toBe('success');
  });

  it('reject fails execution', async () => {
    await enqueueManual();

    const exec = (await db.select().from(executionsTable)).at(-1)!;
    expect(exec.status).toBe('waiting');

    const resumed = await runtime.resumeHitl({
      executionId: exec.id,
      nodeId: 'ap',
      decision: 'reject',
    });
    expect(resumed.status).toBe('failed');

    const after = (await db.select().from(executionsTable)).find((e) => e.id === exec.id);
    expect(after?.status).toBe('failed');
  });

  it('auto-rejects on timeout via sweeper', async () => {
    await enqueueManual();

    const exec = (await db.select().from(executionsTable)).at(-1)!;
    expect(exec.status).toBe('waiting');

    const waitingRun = (await db.select().from(nodeRunsTable).where(eq(nodeRunsTable.nodeId, 'ap'))).at(-1)!;
    const metadata = JSON.parse(waitingRun.metadata ?? '{}') as Record<string, unknown>;
    metadata.hitl = {
      ...(metadata.hitl as Record<string, unknown>),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      timeoutAction: 'reject',
    };
    await db
      .update(nodeRunsTable)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(nodeRunsTable.id, waitingRun.id));

    const resolved = await runHitlTimeoutSweepOnce({
      listWaitingExecutionIds: async () => [exec.id],
      findWaitingNodeRun: async (executionId) => {
        const row = await runtime.nodeRunRepo.findWaitingByExecution(executionId);
        if (!row) return null;
        return { nodeId: row.nodeId, metadata: row.metadata };
      },
      resumeHitl: (input) => runtime.resumeHitl(input),
    });
    expect(resolved).toBe(1);

    const after = (await db.select().from(executionsTable)).find((e) => e.id === exec.id);
    expect(after?.status).toBe('failed');
  });
});
