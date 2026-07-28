import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { openStandardDatabase } from '../drizzle/client.js';
import { workflowVersions } from '../drizzle/schema.js';
import { createStandardWorkflowRepository } from './workflow-repository.js';
import { createStandardExecutionRepository } from './execution-repository.js';
import { createWorkflowService } from '@rxwf/workflow';

const DATABASE_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';

describe('createStandardExecutionRepository', () => {
  let pool: pg.Pool | undefined;
  let skip = false;

  beforeAll(async () => {
    try {
      pool = new pg.Pool({ connectionString: DATABASE_URL });
      await pool.query('SELECT 1');
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('listAll returns executions with workflow name', async () => {
    if (skip) return;
    const { pool: pgPool, db } = await openStandardDatabase(DATABASE_URL);
    const workflows = createWorkflowService(createStandardWorkflowRepository(db));
    const executions = createStandardExecutionRepository(db);

    const created = await workflows.create({
      name: 'PG List Test',
      definition: {
        schemaVersion: 1,
        name: 'PG List Test',
        nodes: [
          {
            id: 't1',
            type: 'manualtrigger',
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
    const latest = (await workflows.get(created.id))!.definition;

    const executionId = crypto.randomUUID();
    await executions.insertExecution({
      id: executionId,
      traceId: 'trace-pg-1',
      workflowId: created.id,
      workflowVersionId: versionId,
      definitionSnapshot: JSON.stringify(latest),
      status: 'success',
      mode: 'manual',
      environment: 'test',
    });

    const { items, total } = await executions.listAll({ limit: 10 });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.workflowId === created.id)).toBe(true);

    await pgPool.end();
  });
});
