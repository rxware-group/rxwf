import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type {
  KnowledgeIndexJobPayload,
  KnowledgeSyncJobPayload,
} from '@rxwf/knowledge';

export interface BullMQKnowledgeQueueHandle {
  enqueueIndexJob(payload: KnowledgeIndexJobPayload): Promise<void>;
  enqueueSyncJob(payload: KnowledgeSyncJobPayload): Promise<void>;
  startWorker(handlers: {
    indexDocument: (payload: KnowledgeIndexJobPayload) => Promise<void>;
    syncFromSource: (payload: KnowledgeSyncJobPayload) => Promise<void>;
  }): Promise<() => Promise<void>>;
}

export function createBullMQKnowledgeQueue(options: {
  redisUrl: string;
  queueName?: string;
  concurrency?: number;
}): BullMQKnowledgeQueueHandle {
  const queueName = options.queueName ?? 'rxwf-knowledge-jobs';
  const workerConcurrency = Number.isFinite(options.concurrency)
    ? Math.max(1, Math.floor(options.concurrency!))
    : 2;
  const connection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });

  return {
    async enqueueIndexJob(payload) {
      await queue.add('knowledge.index', payload, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    },

    async enqueueSyncJob(payload) {
      await queue.add('knowledge.sync', payload, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    },

    async startWorker(handlers) {
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          if (job.name === 'knowledge.index') {
            await handlers.indexDocument(job.data as KnowledgeIndexJobPayload);
            return;
          }
          if (job.name === 'knowledge.sync') {
            await handlers.syncFromSource(job.data as KnowledgeSyncJobPayload);
          }
        },
        {
          connection: new Redis(options.redisUrl, { maxRetriesPerRequest: null }),
          concurrency: workerConcurrency,
        },
      );

      return async () => {
        await worker.close();
        await queue.close();
        await connection.quit();
      };
    },
  };
}
