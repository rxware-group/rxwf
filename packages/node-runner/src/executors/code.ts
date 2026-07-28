import type { SandboxRunInput, SandboxRunResult } from '@rxwf/sandbox';
import type { NodeExecutor } from '../types/node-executor.js';
import { expressionMetaFromNodeContext } from '../expression/item-context.js';
import { resolveCodeSandboxTimeoutMs } from './resolve-code-sandbox-timeout.js';

export interface CodeExecutorDeps {
  runInSandbox(input: SandboxRunInput): Promise<SandboxRunResult>;
}

export function createCodeExecutor(deps: CodeExecutorDeps): NodeExecutor {
  return {
    type: 'code',
    async execute(ctx) {
      const code = String(ctx.config.jsCode ?? ctx.config.code ?? '');
      const timeoutMs = resolveCodeSandboxTimeoutMs(ctx.config, ctx.env);
      const { items, logs } = await deps.runInSandbox({
        code,
        inputItems: ctx.inputItems,
        env: ctx.env,
        vars: ctx.vars,
        nodes: ctx.nodes,
        timeoutMs,
        ...expressionMetaFromNodeContext(ctx),
      });
      return {
        status: 'success',
        outputItems: [items],
        logs,
      };
    },
  };
}
