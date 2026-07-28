import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';

export function webhookItemsFromContext(
  inputItems: WorkflowItem[],
  configBody: unknown,
): WorkflowItem[] {
  if (inputItems.length > 0) {
    return inputItems;
  }
  const body =
    typeof configBody === 'object' && configBody !== null
      ? (configBody as Record<string, unknown>)
      : {};
  return [{ json: body }];
}

export const webhookTriggerExecutor: NodeExecutor = {
  type: 'webhookTrigger',
  async execute(ctx) {
    const items = webhookItemsFromContext(ctx.inputItems, ctx.config.body);
    return {
      status: 'success',
      outputItems: [items],
    };
  },
};
