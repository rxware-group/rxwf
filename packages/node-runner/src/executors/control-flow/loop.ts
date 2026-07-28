import type { NodeExecutor } from '../../types/node-executor.js';

/** Loop iteration is handled by the execution engine; this stub satisfies the registry. */
export const loopExecutor: NodeExecutor = {
  type: 'loop',
  async execute() {
    return {
      status: 'success',
      outputItems: [[], []],
    };
  },
};
