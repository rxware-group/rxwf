import { describe, it, expect } from 'vitest';
import { createLiteIdempotencyService } from './idempotency-service.js';
import { createLiteExecutionRepository } from './execution-repository.js';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createWorkflowService } from '@rxwf/workflow';
import { createTestDb } from './test-db.js';
import { eq } from 'drizzle-orm';
import { workflowVersions } from './drizzle/schema.js';

describe('createLiteIdempotencyService', () => {
  it('stores and retrieves execution by idempotency key', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Idem',
      definition: {
        schemaVersion: 1,
        name: 'Idem',
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
      id: 'ex-1',
      traceId: 'tr-1',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'success',
      mode: 'production',
      environment: 'prod',
    });
    const idem = createLiteIdempotencyService(db);
    await idem.complete({
      key: 'dup-key',
      scope: 'webhook',
      executionId: 'ex-1',
    });
    const found = await idem.find('dup-key', 'webhook');
    expect(found?.executionId).toBe('ex-1');
  });
});
