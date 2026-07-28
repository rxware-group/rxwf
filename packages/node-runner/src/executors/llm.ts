import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import { resolveInputItemTemplateString } from '../expression/item-context.js';
import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '../types/node-executor.js';

export interface LlmExecutorDeps {
  ai?: AiRuntime;
  resolveOllamaModelRef?: (
    nodeConfig: Record<string, unknown>,
  ) => Promise<ModelRef>;
}

export async function resolveLlmPrompt(ctx: NodeExecutionContext): Promise<string> {
  return resolveInputItemTemplateString(String(ctx.config.prompt ?? ''), ctx, 0);
}

export async function runLlmChat(
  deps: LlmExecutorDeps,
  config: Record<string, unknown>,
  prompt: string,
): Promise<string> {
  if (!deps.ai) {
    const { AwfError } = await import('@rxwf/shared');
    throw new AwfError('E3001', 'AI runtime not configured');
  }
  const modelRef = deps.resolveOllamaModelRef
    ? await deps.resolveOllamaModelRef(config)
    : {
        provider: 'ollama' as const,
        model: String(config.model ?? '').trim() || 'llama3',
      };
  let text = '';
  for await (const chunk of deps.ai.chat([{ role: 'user', content: prompt }], {
    model: modelRef,
  })) {
    text += chunk;
  }
  return text;
}

export function createLlmExecutor(deps: LlmExecutorDeps): NodeExecutor {
  return {
    type: 'llm',
    async execute(ctx: NodeExecutionContext): Promise<NodeRunResult> {
      try {
        const prompt = await resolveLlmPrompt(ctx);
        const text = await runLlmChat(deps, ctx.config, prompt);
        return {
          status: 'success',
          outputItems: [[{ json: { response: text } }]],
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
