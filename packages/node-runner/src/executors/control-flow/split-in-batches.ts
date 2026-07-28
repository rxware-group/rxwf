import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';

function resolveBatchSize(config: Record<string, unknown>): number {
  const raw = Number(config.batchSize ?? 1);
  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }
  return Math.floor(raw);
}

export function splitInputItems(
  items: WorkflowItem[],
  batchSize: number,
): WorkflowItem[][] {
  const size = resolveBatchSize({ batchSize });
  const batches: WorkflowItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches.length ? batches : [items];
}

export const splitInBatchesExecutor: NodeExecutor = {
  type: 'splitInBatches',
  async execute(ctx) {
    const batches = splitInputItems(ctx.inputItems, resolveBatchSize(ctx.config));
    return {
      status: 'success',
      outputItems: batches,
    };
  },
};
