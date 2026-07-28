import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { QueueProvider } from '@rxwf/providers-contracts';
import type { ExecutionEnqueueJobPayload, PendingJob } from '@rxwf/execution';

const PROBE_KIND = 'rxwf.ready.probe';

export interface BullMQQueueHandle {
  provider: QueueProvider;
  enqueueExecutionJob(payload: ExecutionEnqueueJobPayload): Promise<void>;
  startWorker(
    handler: (
      payload: ExecutionEnqueueJobPayload,
    ) => Promise<{ executionId: string; status: string }>,
  ): Promise<() => Promise<void>>;
}

export function createBullMQQueueProvider(options: {
  redisUrl: string;
  queueName?: string;
  concurrency?: number;
}): BullMQQueueHandle {
  const queueName = options.queueName ?? 'rxwf-execution-jobs';
  const workerConcurrency = Number.isFinite(options.concurrency)
    ? Math.max(1, Math.floor(options.concurrency!))
    : 4;
  const connection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });

  const queue = new Queue(queueName, { connection });

  const provider: QueueProvider = {
    async enqueue(kind: string, payload: unknown): Promise<string> {
      const job = await queue.add(kind, payload, {
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      return String(job.id ?? '');
    },

    async claimPending(_limit: number): Promise<PendingJob[]> {
      return [];
    },

    async markCompleted(_jobId: string): Promise<void> {},

    async markFailed(_jobId: string, _errorMessage: string): Promise<void> {},

    async runProbe(
      handler: () => Promise<void>,
      timeoutMs = 5000,
    ): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        const worker = new Worker(
          queueName,
          async (job: Job) => {
            if (job.name !== PROBE_KIND) return;
            await handler();
            clearTimeout(timer);
            await worker.close();
            resolve(true);
          },
          {
            connection: new Redis(options.redisUrl, {
              maxRetriesPerRequest: null,
            }),
          },
        );
        void queue.add(PROBE_KIND, {}, { jobId: `probe-${Date.now()}` });
      });
    },
  };

  return {
    provider,
    async enqueueExecutionJob(payload) {
      await queue.add('execution.enqueue', payload, {
        removeOnComplete: 200,
        removeOnFail: 100,
      });
    },

    async startWorker(handler) {
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          if (job.name === PROBE_KIND) return;
          if (job.name !== 'execution.enqueue') return;
          const payload = job.data as ExecutionEnqueueJobPayload;
          await handler(payload);
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
