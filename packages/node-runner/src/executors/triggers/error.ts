import type { NodeExecutor } from '../../types/node-executor.js';
import { AwfError } from '@rxwf/shared';

export const errorTriggerExecutor: NodeExecutor = {
  type: 'errorTrigger',
  async execute(ctx) {
    if (!ctx.errorPayload) {
      throw new AwfError('E2002', 'errorTrigger requires errorPayload');
    }
    return {
      status: 'success',
      outputItems: [[{ json: { ...ctx.errorPayload } }]],
    };
  },
};
