import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createLiteNodeRunRepository } from './node-run-repository.js';
import { createLiteExecutionRepository } from './execution-repository.js';
import { createLiteRunnerRepository } from './runner-repository.js';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createWorkflowService } from '@rxwf/workflow';
import { createTestDb } from './test-db.js';
import { nodeRuns, runners, workflowVersions } from './drizzle/schema.js';

describe('createLiteNodeRunRepository', () => {
  it('records pending then finished node runs with runner platform', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'NR',
      definition: {
        schemaVersion: 1,
        name: 'NR',
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
    const versionRows = await db
      .select({ id: workflowVersions.id })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, created.id))
      .limit(1);
    const executionRepo = createLiteExecutionRepository(db);
    await executionRepo.insertExecution({
      id: 'ex-nr',
      traceId: 'trace-nr',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'running',
      mode: 'production',
      environment: 'prod',
    });

    const runnerRepo = createLiteRunnerRepository(db);
    const embedded = await runnerRepo.ensureEmbedded(
      { os: 'linux', arch: 'x64' },
      ['code'],
    );

    const repo = createLiteNodeRunRepository(db);
    await repo.insertPending({
      id: 'nr-1',
      executionId: 'ex-nr',
      nodeId: 't1',
      nodeType: 'manualTrigger',
    });
    const runnerRows = await db.select().from(runners);
    expect(runnerRows.some((r) => r.id === embedded.id)).toBe(true);

    await repo.finish({
      id: 'nr-1',
      status: 'success',
      durationMs: 12,
      runnerId: embedded.id,
      runnerPlatform: { os: 'linux', arch: 'x64' },
    });

    const rows = await db.select().from(nodeRuns).where(eq(nodeRuns.executionId, 'ex-nr'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('success');
    expect(rows[0]?.nodeId).toBe('t1');
    expect(JSON.parse(rows[0]!.runnerPlatform!)).toEqual({ os: 'linux', arch: 'x64' });
  });

  it('persists metadata with agentSteps on finish', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'NR Meta',
      definition: {
        schemaVersion: 1,
        name: 'NR Meta',
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
    const versionRows = await db
      .select({ id: workflowVersions.id })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, created.id))
      .limit(1);
    const executionRepo = createLiteExecutionRepository(db);
    await executionRepo.insertExecution({
      id: 'ex-nr-meta',
      traceId: 'trace-nr-meta',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'running',
      mode: 'production',
      environment: 'prod',
    });

    const repo = createLiteNodeRunRepository(db);
    await repo.insertPending({
      id: 'nr-meta',
      executionId: 'ex-nr-meta',
      nodeId: 'agt',
      nodeType: 'aiAgent',
    });
    await repo.finish({
      id: 'nr-meta',
      status: 'success',
      durationMs: 5,
      metadata: {
        agentSteps: [{ type: 'tool', tool: 'X', status: 'success', durationMs: 1 }],
      },
    });

    const listed = await repo.listByExecutionId('ex-nr-meta');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.metadata?.agentSteps).toEqual([
      { type: 'tool', tool: 'X', status: 'success', durationMs: 1 },
    ]);
  });

  it('patchMetadata updates running node run metadata', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Patch Meta',
      definition: {
        schemaVersion: 1,
        name: 'Patch Meta',
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
    const versionRows = await db
      .select({ id: workflowVersions.id })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, created.id))
      .limit(1);
    const executionRepo = createLiteExecutionRepository(db);
    await executionRepo.insertExecution({
      id: 'ex-patch',
      traceId: 'trace-patch',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'running',
      mode: 'production',
      environment: 'prod',
    });

    const repo = createLiteNodeRunRepository(db);
    await repo.insertPending({
      id: 'nr-patch',
      executionId: 'ex-patch',
      nodeId: 'crew',
      nodeType: 'crewSupervisor',
    });
    await repo.patchMetadata('nr-patch', {
      agentSteps: [{ type: 'agent_step', status: 'success', output: { supervisor: 'S' } }],
    });

    const listed = await repo.listByExecutionId('ex-patch');
    expect(listed[0]?.metadata?.agentSteps).toHaveLength(1);
    expect(listed[0]?.status).toBe('running');
  });

  it('lists node runs in stable createdAt/id order', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'NR Order',
      definition: {
        schemaVersion: 1,
        name: 'NR Order',
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
    const versionRows = await db
      .select({ id: workflowVersions.id })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, created.id))
      .limit(1);
    const executionRepo = createLiteExecutionRepository(db);
    await executionRepo.insertExecution({
      id: 'ex-order',
      traceId: 'trace-order',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'running',
      mode: 'production',
      environment: 'prod',
    });

    const repo = createLiteNodeRunRepository(db);
    await repo.insertPending({
      id: 'nr-z',
      executionId: 'ex-order',
      nodeId: 'n-z',
      nodeType: 'set',
    });
    await repo.insertPending({
      id: 'nr-a',
      executionId: 'ex-order',
      nodeId: 'n-a',
      nodeType: 'set',
    });
    await db
      .update(nodeRuns)
      .set({ createdAt: new Date('2026-01-01T00:00:02.000Z') })
      .where(eq(nodeRuns.id, 'nr-z'));
    await db
      .update(nodeRuns)
      .set({ createdAt: new Date('2026-01-01T00:00:01.000Z') })
      .where(eq(nodeRuns.id, 'nr-a'));

    const listed = await repo.listByExecutionId('ex-order');
    expect(listed.map((row) => row.id)).toEqual(['nr-a', 'nr-z']);
  });
});
