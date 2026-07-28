import { AwfError } from '@rxwf/shared';
import type {
  AgentRunInput,
  AgentRunResult,
  AiChatOptions,
  AiExecutionContext,
  AiRuntime,
  ChatMessage,
} from '@rxwf/ai-runtime-stub';

export type { AiRuntime, ChatMessage };

export interface OllamaRuntimeOptions {
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export function createOllamaAiRuntime(options: OllamaRuntimeOptions = {}): AiRuntime {
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:11434';
  const model = options.model ?? 'llama3';
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async *chat(
      messages: ChatMessage[],
      opts?: AiChatOptions,
    ): AsyncGenerator<string, void, unknown> {
      const effectiveModel = opts?.model?.model ?? model;
      const effectiveBaseUrl = opts?.model?.baseUrl ?? baseUrl;
      const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      const res = await fetchFn(`${effectiveBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: effectiveModel, prompt, stream: false }),
      });
      if (!res.ok) {
        throw new Error(`Ollama request failed: ${res.status}`);
      }
      const body = (await res.json()) as { response?: string };
      const text = body.response ?? '';
      yield text;
    },
    async runAgent(_input: AgentRunInput, _ctx: AiExecutionContext): Promise<AgentRunResult> {
      throw new AwfError(
        'E3001',
        'Agent execution requires createLangChainAiRuntime (Ollama runtime is chat-only)',
      );
    },
    async runGroupChat() {
      throw new AwfError(
        'E3001',
        'Group chat requires createLangChainAiRuntime (Ollama runtime is chat-only)',
      );
    },
  };
}
