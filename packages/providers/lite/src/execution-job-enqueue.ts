import type { ExecutionEnqueueJobPayload } from '@rxwf/execution';
import type { LiteDatabase } from './db.js';
import { jobs } from './drizzle/schema.js';

export function createLiteExecutionJobEnqueue(db: LiteDatabase) {
  return {
    async enqueueExecutionJob(payload: ExecutionEnqueueJobPayload): Promise<void> {
      await db.insert(jobs).values({
        id: crypto.randomUUID(),
        kind: 'execution.enqueue',
        payload: JSON.stringify(payload),
        status: 'pending',
        createdAt: new Date(),
      });
    },
  };
}
