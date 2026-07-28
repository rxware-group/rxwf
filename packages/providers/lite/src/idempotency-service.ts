import { and, eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { idempotencyKeys } from './drizzle/schema.js';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createLiteIdempotencyService(db: LiteDatabase) {
  return {
    async find(key: string, scope: string) {
      const rows = await db
        .select({
          executionId: idempotencyKeys.executionId,
        })
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return { executionId: row.executionId, status: 'success' };
    },

    async complete(input: {
      key: string;
      scope: string;
      executionId: string;
      ttlMs?: number;
    }): Promise<void> {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS));
      await db.insert(idempotencyKeys).values({
        key: input.key,
        scope: input.scope,
        executionId: input.executionId,
        expiresAt,
        createdAt: now,
      });
    },
  };
}
