import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { encodeBinaryBuffer } from '@rxwf/shared';
import { createTestDb } from './test-db.js';
import { createLiteBinaryBlobService } from './binary-blob-service.js';
import { createLiteExecutionRepository } from './execution-repository.js';
import { createLiteNodeRunRepository } from './node-run-repository.js';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createWorkflowService } from '@rxwf/workflow';
import { executionBlobs, workflowVersions } from './drizzle/schema.js';

describe('createLiteBinaryBlobService', () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  async function seedExecution(db: Awaited<ReturnType<typeof createTestDb>>) {
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Blob WF',
      definition: {
        schemaVersion: 1,
        name: 'Blob WF',
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
      id: 'ex-blob',
      traceId: 'trace-blob',
      workflowId: created.id,
      workflowVersionId: versionRows[0]!.id,
      definitionSnapshot: '{}',
      status: 'running',
      mode: 'manual',
      environment: 'test',
      triggerType: 'manual',
    });
    const nodeRunRepo = createLiteNodeRunRepository(db);
    await nodeRunRepo.insertPending({
      id: 'nr-1',
      executionId: 'ex-blob',
      nodeId: 't1',
      nodeType: 'manualTrigger',
    });
  }

  it('stores and loads binary blob', async () => {
    const db = await createTestDb();
    await seedExecution(db);
    dataDir = await mkdtemp(join(tmpdir(), 'rxwf-blob-'));
    const service = createLiteBinaryBlobService(db, dataDir);
    const payload = Buffer.from('binary-payload');
    const { blobId } = await service.store({
      executionId: 'ex-blob',
      nodeRunId: 'nr-1',
      kind: 'output',
      buffer: payload,
    });
    const loaded = await service.load(blobId);
    expect(loaded.toString()).toBe('binary-payload');
    const rows = await db.select().from(executionBlobs);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sizeBytes).toBe(payload.length);
  });

  it('round-trips through shared encode helper', async () => {
    const db = await createTestDb();
    await seedExecution(db);
    dataDir = await mkdtemp(join(tmpdir(), 'rxwf-blob-'));
    const service = createLiteBinaryBlobService(db, dataDir);
    const att = encodeBinaryBuffer(Buffer.from('png-bytes'), 'image/png', {
      fileName: 'x.png',
    });
    const { blobId } = await service.store({
      executionId: 'ex-blob',
      kind: 'output',
      buffer: Buffer.from(att.data, 'base64'),
    });
    const loaded = await service.load(blobId);
    expect(loaded.toString()).toBe('png-bytes');
  });
});
