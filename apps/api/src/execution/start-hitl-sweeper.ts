import type { ExecutionRuntime } from './create-execution-runtime.js';
import {
  DEFAULT_BATCH_LIMIT,
  startHitlTimeoutSweeper,
} from './hitl-sweeper.js';

export function startHitlTimeoutSweeperForRuntime(
  runtime: ExecutionRuntime,
): () => void {
  return startHitlTimeoutSweeper({
    batchLimit: DEFAULT_BATCH_LIMIT,
    listWaitingExecutionIds: async () => {
      const { items } = await runtime.executionRepo.listAll({
        status: 'waiting',
        limit: DEFAULT_BATCH_LIMIT,
      });
      return items.map((row) => row.id);
    },
    findWaitingNodeRun: async (executionId) => {
      const row = await runtime.nodeRunRepo.findWaitingByExecution(executionId);
      if (!row) return null;
      return { nodeId: row.nodeId, metadata: row.metadata };
    },
    resumeHitl: (input) => runtime.resumeHitl(input),
  });
}
