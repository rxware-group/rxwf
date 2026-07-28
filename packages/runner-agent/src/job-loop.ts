import type {
  RemoteNodeRunJob,
  RemoteNodeRunResult,
  RunnerJobCancelPayload,
  RunnerJobFailedPayload,
  RunnerJobResultPayload,
  RunnerWsEnvelope,
} from '@rxwf/runner-protocol';

import type { JobPool } from './job-pool.js';
import type { JobTracker } from './job-tracker.js';

export type ExtensionHostLike = {
  execute(job: RemoteNodeRunJob): Promise<RemoteNodeRunResult>;
};

export type JobLoopOptions = {
  pool: JobPool;
  tracker: JobTracker;
  host: ExtensionHostLike;
  send: (envelope: RunnerWsEnvelope) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createJobLoop(opts: JobLoopOptions): {
  handleMessage: (envelope: RunnerWsEnvelope) => void;
} {
  async function runJob(job: RemoteNodeRunJob): Promise<void> {
    await opts.pool.accept();

    opts.send({
      type: 'job.accept',
      ts: nowIso(),
      payload: { jobId: job.jobId },
    });

    opts.tracker.track(job.jobId);

    try {
      const result = await opts.host.execute(job);

      if (result.status === 'failed' && result.errorCode) {
        const payload: RunnerJobFailedPayload = {
          jobId: job.jobId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage ?? 'Job failed',
          durationMs: result.durationMs,
        };
        opts.send({ type: 'job.failed', ts: nowIso(), payload });
        return;
      }

      const payload: RunnerJobResultPayload = {
        jobId: job.jobId,
        status: result.status,
        outputItems: result.outputItems,
        metadata: result.metadata,
        durationMs: result.durationMs,
      };
      opts.send({ type: 'job.result', ts: nowIso(), payload });
    } catch (error) {
      const payload: RunnerJobFailedPayload = {
        jobId: job.jobId,
        errorCode: 'E2002',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
      opts.send({ type: 'job.failed', ts: nowIso(), payload });
    } finally {
      opts.tracker.untrack(job.jobId);
      opts.pool.release();
    }
  }

  function handleMessage(envelope: RunnerWsEnvelope): void {
    if (envelope.type === 'job.assign') {
      const job = envelope.payload as RemoteNodeRunJob | undefined;
      if (!job?.jobId) {
        return;
      }
      void runJob(job);
      return;
    }

    if (envelope.type === 'job.cancel') {
      const payload = envelope.payload as RunnerJobCancelPayload | undefined;
      if (payload?.jobId) {
        opts.tracker.cancel(payload.jobId);
      }
    }
  }

  return { handleMessage };
}
