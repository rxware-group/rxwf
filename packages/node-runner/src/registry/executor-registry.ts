import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '../types/node-executor.js';

export function createExecutorRegistry(executors: NodeExecutor[] = []) {
  const byType = new Map<string, NodeExecutor>();
  for (const ex of executors) {
    byType.set(ex.type, ex);
  }

  return {
    register(executor: NodeExecutor): void {
      byType.set(executor.type, executor);
    },
    has(nodeType: string): boolean {
      return byType.has(nodeType);
    },
    async execute(
      nodeType: string,
      ctx: NodeExecutionContext,
    ): Promise<NodeRunResult> {
      const executor = byType.get(nodeType);
      if (!executor) {
        throw new AwfError('E2003', `Unknown node type: ${nodeType}`);
      }
      return executor.execute(ctx);
    },
  };
}

export type ExecutorRegistry = ReturnType<typeof createExecutorRegistry>;
