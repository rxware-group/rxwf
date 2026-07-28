import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createUserService } from '@rxwf/identity';
import { createExecutionRuntime } from './create-execution-runtime.js';

const jobsTable = liteSchema.jobs;
const executionsTable = liteSchema.executions;
const nodeRunsTable = liteSchema.nodeRuns;

describe('execution pipeline', () => {
  it('processes schedule job through scheduleTrigger into successful execution', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const publishUserId = (await createUserService(db).createUser({ email: `u-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const created = await workflows.create({
      name: 'Pipe',
      definition: {
        schemaVersion: 1,
        name: 'Pipe',
        active: true,
        settings: { timezone: 'UTC' },
        nodes: [
          {
            id: 'sched-1',
            type: 'scheduleTrigger',
            name: 'Daily',
            position: { x: 0, y: 0 },
            parameters: { cron: '0 10 * * *' },
          },
          {
            id: 'set-1',
            type: 'set',
            name: 'Mark',
            position: { x: 200, y: 0 },
            parameters: { fields: { done: true } },
          },
        ],
        connections: [{ from: 'sched-1', to: 'set-1' }],
      },
    });
    await workflows.publish(created.id, publishUserId);

    await db.insert(jobsTable).values({
      id: 'job-1',
      kind: 'execution.enqueue',
      payload: JSON.stringify({
        workflowId: created.id,
        triggerType: 'schedule',
      }),
      status: 'pending',
      createdAt: new Date(),
    });

    const runtime = await createExecutionRuntime(db);
    await runtime.jobProcessor.processOnce();

    const executions = await db.select().from(executionsTable);
    expect(executions).toHaveLength(1);
    expect(executions[0]?.status).toBe('success');
    const snap = JSON.parse(executions[0]!.definitionSnapshot) as { version: number };
    expect(snap.version).toBe(1);

    const jobs = await db.select().from(jobsTable);
    expect(jobs[0]?.status).toBe('completed');

    const nodeRunRows = await db.select().from(nodeRunsTable);
    expect(nodeRunRows).toHaveLength(2);
    expect(nodeRunRows.every((r) => r.status === 'success')).toBe(true);
    expect(nodeRunRows[0]?.runnerPlatform).toBeTruthy();
  });
});
