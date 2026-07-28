export interface PendingJob {
  id: string;
  kind: string;
  payload: unknown;
}

export interface QueueProvider {
  enqueue(kind: string, payload: unknown): Promise<string>;
  claimPending(limit: number): Promise<PendingJob[]>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, errorMessage: string): Promise<void>;
  /** Probe: enqueue and wait until handler completes (for /api/ready). */
  runProbe?(handler: () => Promise<void>, timeoutMs?: number): Promise<boolean>;
}
