export interface PendingJob {
  id: string;
  kind: string;
  payload: string;
}

import type { WorkflowItem } from '@rxwf/shared';

export interface ExecutionEnqueueJobPayload {
  workflowId: string;
  triggerType: 'manual' | 'webhook' | 'schedule' | 'api' | 'mcp' | 'subworkflow' | 'error';
  mode?: 'production' | 'manual';
  definitionSource?: 'draft' | 'published';
  idempotencyKey?: string;
  body?: string;
  parentExecutionId?: string;
  subworkflowDepth?: number;
  inputItems?: WorkflowItem[];
  sessionId?: string;
  /** Error workflow recursion depth */
  errorDepth?: number;
  /** Nested failure context from createErrorWorkflowService */
  payload?: Record<string, unknown>;
}

export interface JobHandler {
  kind: string;
  handle(payload: string): Promise<void>;
}

export interface JobProcessorDeps {
  claimPending(limit: number): Promise<PendingJob[]>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, errorMessage: string): Promise<void>;
  handlers: JobHandler[];
  concurrency?: number;
  onProcessed?: (summary: {
    claimed: number;
    completed: number;
    failed: number;
    elapsedMs: number;
    concurrency: number;
  }) => void;
}

/** @deprecated use handlers array */
export function executionEnqueueHandler(
  handleEnqueue: (payload: ExecutionEnqueueJobPayload) => Promise<{
    executionId: string;
    status: string;
  }>,
): JobHandler {
  return {
    kind: 'execution.enqueue',
    handle: async (payload) => {
      await handleEnqueue(JSON.parse(payload) as ExecutionEnqueueJobPayload);
    },
  };
}

export function createJobProcessor(deps: JobProcessorDeps) {
  const concurrency = Math.max(1, Math.floor(deps.concurrency ?? 1));
  return {
    async processOnce(limit = 10): Promise<number> {
      const startedAt = Date.now();
      const jobs = await deps.claimPending(limit);
      let completed = 0;
      let failed = 0;
      const processJob = async (job: PendingJob) => {
        try {
          const handler = deps.handlers.find((h) => h.kind === job.kind);
          if (!handler) {
            await deps.markFailed(job.id, `Unsupported job kind: ${job.kind}`);
            failed += 1;
            return;
          }
          await handler.handle(job.payload);
          await deps.markCompleted(job.id);
          completed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await deps.markFailed(job.id, message);
          failed += 1;
        }
      };

      const queue = [...jobs];
      const workers = Array.from(
        { length: Math.min(concurrency, queue.length) },
        async () => {
          while (queue.length > 0) {
            const job = queue.shift();
            if (!job) return;
            await processJob(job);
          }
        },
      );
      await Promise.all(workers);
      deps.onProcessed?.({
        claimed: jobs.length,
        completed,
        failed,
        elapsedMs: Date.now() - startedAt,
        concurrency,
      });
      return jobs.length;
    },
  };
}
