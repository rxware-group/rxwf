import type { NodeExecutor } from '../../types/node-executor.js';

export const subworkflowTriggerExecutor: NodeExecutor = {
  type: 'subworkflowTrigger',
  async execute(ctx) {
    const items = ctx.inputItems.length > 0 ? ctx.inputItems : [{ json: {} }];
    return {
      status: 'success',
      outputItems: [items],
    };
  },
};
