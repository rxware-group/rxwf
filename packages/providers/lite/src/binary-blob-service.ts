import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { executionBlobs } from './drizzle/schema.js';

export function createLiteBinaryBlobService(db: LiteDatabase, dataDir: string) {
  const blobRoot = join(dataDir, 'blobs');

  return {
    async store(params: {
      executionId: string;
      nodeRunId?: string;
      kind: 'input' | 'output';
      buffer: Buffer;
    }): Promise<{ blobId: string; sha256: string; sizeBytes: number }> {
      const blobId = randomUUID();
      const sha256 = createHash('sha256').update(params.buffer).digest('hex');
      const executionDir = join(blobRoot, params.executionId);
      await mkdir(executionDir, { recursive: true });
      const fileName = `${blobId}.bin`;
      const absolutePath = join(executionDir, fileName);
      const storagePath = join('blobs', params.executionId, fileName);
      await writeFile(absolutePath, params.buffer);
      await db.insert(executionBlobs).values({
        id: blobId,
        executionId: params.executionId,
        nodeRunId: params.nodeRunId ?? null,
        kind: params.kind,
        storagePath,
        sizeBytes: params.buffer.length,
        sha256,
        createdAt: new Date(),
      });
      return { blobId, sha256, sizeBytes: params.buffer.length };
    },

    async load(blobId: string): Promise<Buffer> {
      const rows = await db
        .select()
        .from(executionBlobs)
        .where(eq(executionBlobs.id, blobId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error(`Execution blob not found: ${blobId}`);
      }
      return readFile(join(dataDir, row.storagePath));
    },
  };
}

export type LiteBinaryBlobService = ReturnType<typeof createLiteBinaryBlobService>;
