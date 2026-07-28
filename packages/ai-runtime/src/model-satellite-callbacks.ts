import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';
import type { AiExecutionContext, AiStreamChunk } from '@rxwf/ai-runtime-stub';
import { formatErrorDetail } from '@rxwf/shared';
import {
  extractLangChainMessageText,
  type PromptMessageSnapshot,
  summarizeLangChainMessageRole,
} from './message-content.js';

function summarizeMessages(messages: BaseMessage[][]): PromptMessageSnapshot[] {
  const flat = messages.flat();
  return flat.map((m) => ({
    role: summarizeLangChainMessageRole(m),
    content: extractLangChainMessageText(m.content),
  }));
}

function extractLlmText(output: LLMResult): unknown {
  const gen = output.generations?.[0]?.[0] as
    | { text?: string; message?: { content?: unknown; tool_calls?: unknown[] } }
    | undefined;
  if (!gen) return output;
  if (typeof gen.text === 'string' && gen.text.length > 0) {
    return { content: gen.text };
  }
  const message = gen.message;
  const c = message?.content;
  if (c !== undefined) {
    const text = extractLangChainMessageText(c);
    if (text.trim()) return { content: text };
  }
  const toolCalls = message?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return {
      content: JSON.stringify(
        toolCalls.map((tc) => {
          const call = tc as { name?: string; args?: unknown };
          return { tool: call.name, args: call.args };
        }),
      ),
    };
  }
  if (c !== undefined) return { content: c };
  return output;
}

function formatRoundOutput(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'object' && 'content' in output) {
    const content = (output as { content?: unknown }).content;
    if (typeof content === 'string') return content;
    if (content != null) return JSON.stringify(content);
  }
  if (typeof output === 'string') return output;
  return JSON.stringify(output);
}

export type ModelSatelliteCallbacks = {
  handlers: BaseCallbackHandler[];
  /** Emit satellite_invoke_end for any LLM round-trips that never received handleChatModelEnd. */
  flushPendingInvocations: () => void;
  /** One entry per LLM invocation (satellite_invoke_start), in order. */
  getRoundOutputs: () => string[];
};

export function createModelSatelliteCallbacks(
  ctx: Pick<AiExecutionContext, 'modelNodeId' | 'onSatelliteStream'>,
  options?: {
    /** First LLM round uses agent memory/history roles instead of LangChain callback payloads. */
    initialPromptMessages?: PromptMessageSnapshot[];
  },
): ModelSatelliteCallbacks {
  const modelNodeId = ctx.modelNodeId;
  const emit = ctx.onSatelliteStream;
  if (!modelNodeId || !emit) {
    return { handlers: [], flushPendingInvocations: () => {}, getRoundOutputs: () => [] };
  }
  const satelliteNodeId = modelNodeId;
  let openInvocations = 0;
  let startedAt = 0;
  let llmStartCount = 0;
  const roundOutputs: string[] = [];
  let openStartRunId: string | null = null;
  const initialPromptMessages = options?.initialPromptMessages;

  const push = (chunk: AiStreamChunk) => {
    emit!(satelliteNodeId, chunk);
  };

  const endInvocation = (payload: { output?: unknown; error?: string }): void => {
    if (openInvocations <= 0) return;
    openInvocations -= 1;
    push({
      type: 'satellite_invoke_end',
      output: payload.output,
      error: payload.error,
      durationMs: Math.max(0, Date.now() - startedAt),
    });
  };

  class ModelSatelliteHandler extends BaseCallbackHandler {
    name = 'RxwfModelSatellite';

    async handleChatModelStart(
      _llm: unknown,
      messages: BaseMessage[][],
      runId: string,
    ): Promise<void> {
      if (openStartRunId === runId) return;
      openStartRunId = runId;
      startedAt = Date.now();
      openInvocations += 1;
      llmStartCount += 1;
      const input =
        llmStartCount === 1 && initialPromptMessages?.length
          ? initialPromptMessages
          : summarizeMessages(messages);
      push({
        type: 'satellite_invoke_start',
        input,
      });
    }

    async handleChatModelEnd(output: LLMResult, _runId: string): Promise<void> {
      openStartRunId = null;
      const extracted = extractLlmText(output);
      roundOutputs.push(formatRoundOutput(extracted));
      endInvocation({ output: extracted });
    }

    async handleChatModelError(err: Error, _runId: string): Promise<void> {
      openStartRunId = null;
      roundOutputs.push('');
      endInvocation({ error: formatErrorDetail(err) });
    }
  }

  const flushPendingInvocations = () => {
    while (openInvocations > 0) {
      openStartRunId = null;
      roundOutputs.push('');
      endInvocation({ output: undefined });
    }
  };

  return {
    handlers: [new ModelSatelliteHandler()],
    flushPendingInvocations,
    getRoundOutputs: () => [...roundOutputs],
  };
}
