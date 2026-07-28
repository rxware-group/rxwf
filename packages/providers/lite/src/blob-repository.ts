import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { BinaryBlobStore } from '@rxwf/shared';
import type { LiteDatabase } from './db.js';
import { executionBlobs } from './drizzle/schema.js';

export interface ExecutionBlobInsertRecord {
  id: string;
  executionId: string;
  nodeRunId?: string | null;
  kind: 'input' | 'output';
  storagePath: string;
  sizeBytes: number;
  sha256: string;
  createdAt?: Date;
}

export interface ExecutionBlobRow {
  id: string;
  executionId: string;
  nodeRunId: string | null;
  kind: string;
  storagePath: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
}

function mapRow(row: typeof executionBlobs.$inferSelect): ExecutionBlobRow {
  return {
    id: row.id,
    executionId: row.executionId,
    nodeRunId: row.nodeRunId,
    kind: row.kind,
    storagePath: row.storagePath,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: row.createdAt,
  };
}

/** ADR-005 §2.5 execution_blobs persistence for Lite SQLite. */
export function createLiteBlobRepository(db: LiteDatabase) {
  return {
    async insert(record: ExecutionBlobInsertRecord): Promise<void> {
      await db.insert(executionBlobs).values({
        id: record.id,
        executionId: record.executionId,
        nodeRunId: record.nodeRunId ?? null,
        kind: record.kind,
        storagePath: record.storagePath,
        sizeBytes: record.sizeBytes,
        sha256: record.sha256,
        createdAt: record.createdAt ?? new Date(),
      });
    },

    async getById(blobId: string): Promise<ExecutionBlobRow | undefined> {
      const rows = await db
        .select()
        .from(executionBlobs)
        .where(eq(executionBlobs.id, blobId))
        .limit(1);
      const row = rows[0];
      return row ? mapRow(row) : undefined;
    },

    async listByExecutionId(executionId: string): Promise<ExecutionBlobRow[]> {
      const rows = await db
        .select()
        .from(executionBlobs)
        .where(eq(executionBlobs.executionId, executionId));
      return rows.map(mapRow);
    },
  };
}

export type LiteBlobRepository = ReturnType<typeof createLiteBlobRepository>;

/** File-backed BinaryBlobStore with execution_blobs metadata (ADR-005 §2.5). */
export function createLiteBlobStore(
  db: LiteDatabase,
  dataDir: string,
): BinaryBlobStore {
  const repo = createLiteBlobRepository(db);
  const blobRoot = join(dataDir, 'blobs');

  return {
    async store(params) {
      const blobId = randomUUID();
      const sha256 = createHash('sha256').update(params.buffer).digest('hex');
      const executionDir = join(blobRoot, params.executionId);
      await mkdir(executionDir, { recursive: true });
      const fileName = `${blobId}.bin`;
      const absolutePath = join(executionDir, fileName);
      const storagePath = join('blobs', params.executionId, fileName);
      await writeFile(absolutePath, params.buffer);
      await repo.insert({
        id: blobId,
        executionId: params.executionId,
        nodeRunId: params.nodeRunId,
        kind: params.kind,
        storagePath,
        sizeBytes: params.buffer.length,
        sha256,
      });
      return { blobId };
    },

    async load(blobId) {
      const row = await repo.getById(blobId);
      if (!row) {
        throw new Error(`Execution blob not found: ${blobId}`);
      }
      return readFile(join(dataDir, row.storagePath));
    },
  };
}
