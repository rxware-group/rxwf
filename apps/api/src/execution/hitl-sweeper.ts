import {
  isHitlExpired,
  parseHitlMetadata,
  resolveHitlTimeoutDecision,
} from '@rxwf/execution';

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_BATCH_LIMIT = 200;

export type HitlTimeoutSweeperDeps = {
  listWaitingExecutionIds: () => Promise<string[]>;
  findWaitingNodeRun: (executionId: string) => Promise<{
    nodeId: string;
    metadata: Record<string, unknown> | null;
  } | null>;
  resumeHitl: (input: {
    executionId: string;
    nodeId: string;
    decision: 'approve' | 'reject';
    comment?: string;
  }) => Promise<{ status: string }>;
  intervalMs?: number;
  batchLimit?: number;
  now?: () => number;
};

export async function runHitlTimeoutSweepOnce(
  deps: HitlTimeoutSweeperDeps,
): Promise<number> {
  const nowMs = deps.now?.() ?? Date.now();
  const executionIds = await deps.listWaitingExecutionIds();
  let resolved = 0;

  for (const executionId of executionIds) {
    const waitingRun = await deps.findWaitingNodeRun(executionId);
    if (!waitingRun) continue;

    const hitl = parseHitlMetadata(waitingRun.metadata);
    if (!hitl || !isHitlExpired(hitl, nowMs)) continue;

    const decision = resolveHitlTimeoutDecision(hitl);
    await deps.resumeHitl({
      executionId,
      nodeId: waitingRun.nodeId,
      decision,
      comment: 'Auto-resolved on timeout',
    });
    resolved += 1;
  }

  return resolved;
}

export function startHitlTimeoutSweeper(deps: HitlTimeoutSweeperDeps): () => void {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;

  const runOnce = () => {
    void runHitlTimeoutSweepOnce(deps).catch((err) => {
      console.error('[hitl] timeout sweep failed', err);
    });
  };

  void runHitlTimeoutSweepOnce(deps).catch((err) => {
    console.error('[hitl] timeout sweep failed', err);
  });

  const timer = setInterval(runOnce, intervalMs);
  return () => clearInterval(timer);
}

export { DEFAULT_BATCH_LIMIT, DEFAULT_INTERVAL_MS };
