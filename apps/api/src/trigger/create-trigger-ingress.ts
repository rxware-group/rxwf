import {
  createTriggerIngress,
  webhookIdempotencyScope,
  type TriggerIngress,
} from '@rxwf/execution';
import type { ExecutionRuntime } from '../execution/create-execution-runtime.js';
import {
  createLiteExecutionJobEnqueue,
  createLiteIdempotencyService,
} from '@rxwf/providers-lite';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { createBullMQQueueProvider } from '@rxwf/providers-standard';
import { config } from '../config.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createApiTriggerIngress(
  db: LiteDatabase,
  runtime: ExecutionRuntime,
): TriggerIngress {
  const jobEnqueue = createLiteExecutionJobEnqueue(db);
  const idempotency = createLiteIdempotencyService(db);
  const useBullMQ =
    config.deployProfile === 'standard' && Boolean(config.redisUrl);
  const bull = useBullMQ
    ? createBullMQQueueProvider({ redisUrl: config.redisUrl })
    : null;

  return createTriggerIngress({
    idempotency: {
      find: (key, scope) => idempotency.find(key, scope),
    },
    enqueue: async (input) => {
      if (bull) {
        await bull.enqueueExecutionJob({
          workflowId: input.workflowId,
          triggerType: 'webhook',
          mode: input.mode,
          idempotencyKey: input.idempotencyKey,
          body: input.body,
          inputItems: input.inputItems,
          sessionId: input.sessionId,
        });
        for (let i = 0; i < 100; i++) {
          await sleep(50);
          const cached = await idempotency.find(
            input.idempotencyKey,
            webhookIdempotencyScope(input.mode),
          );
          if (cached) {
            return {
              executionId: cached.executionId,
              status: cached.status,
            };
          }
        }
        throw new Error('Webhook execution did not complete idempotency registration');
      }

      await jobEnqueue.enqueueExecutionJob({
        workflowId: input.workflowId,
        triggerType: 'webhook',
        mode: input.mode,
        idempotencyKey: input.idempotencyKey,
        body: input.body,
        inputItems: input.inputItems,
        sessionId: input.sessionId,
      });
      await runtime.jobProcessor.processOnce();
      const cached = await idempotency.find(
        input.idempotencyKey,
        webhookIdempotencyScope(input.mode),
      );
      if (cached) {
        return {
          executionId: cached.executionId,
          status: cached.status,
        };
      }
      throw new Error('Webhook execution did not complete idempotency registration');
    },
  });
}
