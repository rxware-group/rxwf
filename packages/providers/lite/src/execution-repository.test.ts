import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createLiteExecutionRepository } from './execution-repository.js';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createWorkflowService } from '@rxwf/workflow';
import { createTestDb } from './test-db.js';
import { workflowVersions } from './drizzle/schema.js';

describe('createLiteExecutionRepository', () => {
  it('inserts and reads execution with definition snapshot', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Exec',
      definition: {
        schemaVersion: 1,
        name: 'Exec',
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
    const versionId = versionRows[0]!.id;
    const repo = createLiteExecutionRepository(db);
    await repo.insertExecution({
      id: 'ex-1',
      traceId: 'trace-1',
      workflowId: created.id,
      workflowVersionId: versionId,
      definitionSnapshot: JSON.stringify({ nodes: [], connections: [], version: 1 }),
      status: 'queued',
      mode: 'production',
      environment: 'prod',
    });
    const row = await repo.getExecution('ex-1');
    expect(row?.workflowVersionId).toBeTruthy();
    expect(JSON.parse(row!.definitionSnapshot).version).toBe(1);
  });
});
