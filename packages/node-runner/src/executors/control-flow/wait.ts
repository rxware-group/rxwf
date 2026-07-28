import { AwfError } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';

function resolveWaitMs(config: Record<string, unknown>): number {
  const ms = Number(config.ms ?? 1000);
  if (!Number.isFinite(ms) || ms < 0) {
    throw new AwfError('E2003', 'wait requires a non-negative ms value');
  }
  return ms;
}

export const waitExecutor: NodeExecutor = {
  type: 'wait',
  async execute(ctx) {
    const ms = resolveWaitMs(ctx.config);
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    return { status: 'success', outputItems: [ctx.inputItems] };
  },
};
