import type {
  KnowledgeIndexJobPayload,
  KnowledgeSyncJobPayload,
} from '@rxwf/knowledge';
import type { LiteDatabase } from './db.js';
import { jobs } from './drizzle/schema.js';

export function createLiteKnowledgeJobEnqueue(db: LiteDatabase) {
  return {
    async enqueueKnowledgeIndex(payload: KnowledgeIndexJobPayload): Promise<void> {
      await db.insert(jobs).values({
        id: crypto.randomUUID(),
        kind: 'knowledge.index',
        payload: JSON.stringify(payload),
        status: 'pending',
        createdAt: new Date(),
      });
    },

    async enqueueKnowledgeSync(payload: KnowledgeSyncJobPayload): Promise<void> {
      await db.insert(jobs).values({
        id: crypto.randomUUID(),
        kind: 'knowledge.sync',
        payload: JSON.stringify(payload),
        status: 'pending',
        createdAt: new Date(),
      });
    },
  };
}
