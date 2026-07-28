import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';

/** Build output items for Schedule Trigger: pass-through input or emit cron metadata. */
export function parseScheduleTriggerOutput(
  config: Record<string, unknown>,
  inputItems: WorkflowItem[],
): WorkflowItem[] {
  if (inputItems.length > 0) return inputItems;
  const cron = typeof config.cron === 'string' ? config.cron.trim() : '';
  return [{ json: cron ? { cron } : {} }];
}

export const scheduleTriggerExecutor: NodeExecutor = {
  type: 'scheduleTrigger',
  async execute(ctx) {
    const items = parseScheduleTriggerOutput(ctx.config, ctx.inputItems);
    return {
      status: 'success',
      outputItems: [items],
    };
  },
};
