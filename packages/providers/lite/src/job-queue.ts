import { eq } from 'drizzle-orm';
import type { PendingJob } from '@rxwf/execution';
import type { LiteDatabase } from './db.js';
import { jobs as jobsTable } from './drizzle/schema.js';

export function createLiteJobQueue(db: LiteDatabase) {
  return {
    async claimPending(limit: number): Promise<PendingJob[]> {
      const rows = await db
        .select({
          id: jobsTable.id,
          kind: jobsTable.kind,
          payload: jobsTable.payload,
        })
        .from(jobsTable)
        .where(eq(jobsTable.status, 'pending'))
        .limit(limit);

      for (const row of rows) {
        await db
          .update(jobsTable)
          .set({ status: 'processing' })
          .where(eq(jobsTable.id, row.id));
      }

      return rows;
    },

    async markCompleted(jobId: string): Promise<void> {
      await db
        .update(jobsTable)
        .set({ status: 'completed' })
        .where(eq(jobsTable.id, jobId));
    },

    async markFailed(jobId: string, _errorMessage: string): Promise<void> {
      await db
        .update(jobsTable)
        .set({ status: 'failed' })
        .where(eq(jobsTable.id, jobId));
    },
  };
}
