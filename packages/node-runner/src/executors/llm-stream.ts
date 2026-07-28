import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '../types/node-executor.js';
import { resolveLlmPrompt, runLlmChat, type LlmExecutorDeps } from './llm.js';

export type LlmStreamExecutorDeps = LlmExecutorDeps;

export function createLlmStreamExecutor(deps: LlmStreamExecutorDeps): NodeExecutor {
  return {
    type: 'llmStream',
    async execute(ctx: NodeExecutionContext): Promise<NodeRunResult> {
      try {
        const prompt = await resolveLlmPrompt(ctx);
        const text = await runLlmChat(deps, ctx.config, prompt);
        return {
          status: 'success',
          outputItems: [[{ json: { stream: text } }]],
        };
      } catch (err) {
        return {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
