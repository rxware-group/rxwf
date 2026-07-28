import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createUserService } from '@rxwf/identity';
import {
  createExecutionRuntime,
  definitionFromSnapshot,
} from './create-execution-runtime.js';

const executionsTable = liteSchema.executions;

describe('subworkflow pipeline', () => {
  it('parent executeWorkflow runs child via unified enqueue and returns child output', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const publishUserId = (await createUserService(db).createUser({ email: `u-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;

    const child = await workflows.create({
      name: 'Child',
      definition: {
        schemaVersion: 1,
        name: 'Child',
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
            id: 's1',
            type: 'set',
            name: 'Mark',
            position: { x: 100, y: 0 },
            parameters: { fields: { child: true } },
          },
        ],
        connections: [{ from: 't1', to: 's1' }],
      },
    });
    await workflows.publish(child.id, publishUserId);

    const parent = await workflows.create({
      name: 'Parent',
      definition: {
        schemaVersion: 1,
        name: 'Parent',
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
            id: 'sw1',
            type: 'executeWorkflow',
            name: 'Call child',
            position: { x: 100, y: 0 },
            parameters: { workflowId: child.id },
          },
        ],
        connections: [{ from: 't1', to: 'sw1' }],
      },
    });
    await workflows.publish(parent.id, publishUserId);

    const runtime = await createExecutionRuntime(db);
    const enqueued = await runtime.enqueueService.enqueue({
      workflowId: parent.id,
      triggerType: 'manual',
      mode: 'manual',
    });
    const stored = await runtime.executionRepo.getExecution(enqueued.executionId);
    expect(stored).toBeTruthy();

    const definition = definitionFromSnapshot(stored!.definitionSnapshot);
    const result = await runtime.runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: 'manual',
      subworkflowDepth: 0,
      parentExecutionId: enqueued.executionId,
    });
    expect(result.status).toBe('success');
    expect(result.finalOutputItems?.[0]?.json).toMatchObject({ child: true });

    const allExecs = await db.select().from(executionsTable);
    expect(allExecs.length).toBeGreaterThanOrEqual(2);
  });
});
