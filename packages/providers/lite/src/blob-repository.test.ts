import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createBinaryBlobService } from '../../../shared/src/binary-blob-service.js';
import { DEFAULT_BINARY_INLINE_MAX_BYTES } from '@rxwf/shared';
import { createTestDb } from './test-db.js';
import { createLiteBlobRepository, createLiteBlobStore } from './blob-repository.js';
import { createLiteExecutionRepository } from './execution-repository.js';
import { createLiteNodeRunRepository } from './node-run-repository.js';
import { createLiteWorkflowRepository } from './workflow-repository.js';
import { createWorkflowService } from '@rxwf/workflow';
import { executionBlobs, workflowVersions } from './drizzle/schema.js';

describe('createLiteBlobRepository', () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
      dataDir = '';
    }
  });

  async function seedExecution(db: Awaited<ReturnType<typeof createTestDb>>) {
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'Blob Repo WF',
      definition: {
        schemaVersion: 1,
        name: 'Blob Repo WF',
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
      id: 'ex-blob-repo',
      traceId: 'trace-blob-repo',
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
      id: 'nr-blob-repo',
      executionId: 'ex-blob-repo',
      nodeId: 't1',
      nodeType: 'manualTrigger',
    });
  }

  it('inserts and retrieves execution_blobs row', async () => {
    const db = await createTestDb();
    await seedExecution(db);
    const repo = createLiteBlobRepository(db);
    await repo.insert({
      id: 'blob-1',
      executionId: 'ex-blob-repo',
      nodeRunId: null,
      kind: 'output',
      storagePath: 'blobs/ex-blob-repo/blob-1.bin',
      sizeBytes: 12,
      sha256: 'abc',
    });
    const row = await repo.getById('blob-1');
    expect(row?.executionId).toBe('ex-blob-repo');
    expect(row?.sizeBytes).toBe(12);
    const rows = await db.select().from(executionBlobs);
    expect(rows).toHaveLength(1);
  });

  it('lists blobs by execution id', async () => {
    const db = await createTestDb();
    await seedExecution(db);
    const repo = createLiteBlobRepository(db);
    await repo.insert({
      id: 'blob-a',
      executionId: 'ex-blob-repo',
      kind: 'output',
      storagePath: 'blobs/ex-blob-repo/blob-a.bin',
      sizeBytes: 1,
      sha256: 'a',
    });
    await repo.insert({
      id: 'blob-b',
      executionId: 'ex-blob-repo',
      kind: 'input',
      storagePath: 'blobs/ex-blob-repo/blob-b.bin',
      sizeBytes: 2,
      sha256: 'b',
    });
    const listed = await repo.listByExecutionId('ex-blob-repo');
    expect(listed).toHaveLength(2);
    expect(listed.map((r) => r.id).sort()).toEqual(['blob-a', 'blob-b']);
  });

  it('createLiteBlobStore round-trips via BinaryBlobService externalize/hydrate', async () => {
    const db = await createTestDb();
    await seedExecution(db);
    dataDir = await mkdtemp(join(tmpdir(), 'rxwf-blob-store-'));
    const store = createLiteBlobStore(db, dataDir);
    const service = createBinaryBlobService(store);
    const large = Buffer.alloc(DEFAULT_BINARY_INLINE_MAX_BYTES + 1, 7);
    const externalized = await service.externalizeItem(
      {
        json: {},
        binary: {
          file: {
            data: large.toString('base64'),
            mimeType: 'application/octet-stream',
            fileSize: large.length,
          },
        },
      },
      { executionId: 'ex-blob-repo', nodeRunId: 'nr-blob-repo' },
    );
    expect(externalized.binary?.file.data).toBe('');
    const hydrated = await service.hydrateItem(externalized);
    expect(Buffer.from(hydrated.binary!.file.data, 'base64').length).toBe(
      large.length,
    );
    const rows = await db.select().from(executionBlobs);
    expect(rows).toHaveLength(1);
  });
});
