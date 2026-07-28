import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { ChatMessage } from '@rxwf/ai-runtime-stub';

/** Normalize LangChain message content (string or content-block array) to plain text. */
export function extractLangChainMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const block = part as { text?: string; content?: string };
          if (typeof block.text === 'string') return block.text;
          if (typeof block.content === 'string') return block.content;
        }
        return '';
      })
      .join('');
  }
  return String(content);
}

function messageRole(message: BaseMessage): string {
  if (typeof message._getType === 'function') {
    return message._getType();
  }
  return (message as { type?: string }).type ?? '';
}

function serializeAssistantRound(message: BaseMessage): string | null {
  const role = messageRole(message);
  if (role !== 'ai' && role !== 'AIMessage') return null;
  const text = extractLangChainMessageText(message.content).trim();
  if (text) return extractLangChainMessageText(message.content);
  const toolCalls = (
    message as { tool_calls?: Array<{ name?: string; args?: unknown }> }
  ).tool_calls;
  if (toolCalls?.length) {
    return JSON.stringify(
      toolCalls.map((tc) => ({
        tool: tc.name,
        args: tc.args,
      })),
    );
  }
  return null;
}

/** Each assistant turn in order, including tool-call-only rounds. */
export function listAssistantRoundTexts(messages: BaseMessage[]): string[] {
  const texts: string[] = [];
  for (const message of messages) {
    const round = serializeAssistantRound(message);
    if (round != null) texts.push(round);
  }
  return texts;
}

/** @deprecated Use listAssistantRoundTexts — kept for callers expecting the old name. */
export function listAssistantTextsFromMessages(messages: BaseMessage[]): string[] {
  return listAssistantRoundTexts(messages);
}

/** Prefer per-invocation callback capture; fill gaps from transcript without duplicating. */
export function resolveLlmResponsesForAgentRun(
  roundOutputs: string[],
  messages: BaseMessage[],
): string[] {
  const transcript = listAssistantRoundTexts(messages);
  if (roundOutputs.length === 0) return transcript;
  return roundOutputs.map((captured, index) => {
    const trimmed = captured.trim();
    if (trimmed) return captured;
    return transcript[index] ?? '';
  });
}

/** Last non-empty assistant text from an agent transcript (skips trailing tool-only turns). */
export function lastAssistantAnswerFromMessages(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    const role = messageRole(message);
    if (role !== 'ai' && role !== 'AIMessage') continue;
    const text = extractLangChainMessageText(message.content).trim();
    if (text) return extractLangChainMessageText(message.content);
  }
  const last = messages[messages.length - 1];
  return last ? extractLangChainMessageText(last.content) : '';
}

function normalizeMemoryRole(role: string): ChatMessage['role'] {
  const normalized = normalizeChatMessageRole(role);
  if (normalized === 'system') return 'system';
  if (normalized === 'assistant') return 'assistant';
  return 'user';
}

export type PromptMessageSnapshot = { role: string; content: string };

/** Canonical roles for debug/telemetry (user | assistant | system | tool). */
export function normalizeChatMessageRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'system') return 'system';
  if (normalized === 'assistant' || normalized === 'ai' || normalized === 'aimessage') {
    return 'assistant';
  }
  if (normalized === 'tool' || normalized === 'toolmessage') return 'tool';
  if (normalized === 'user' || normalized === 'human' || normalized === 'humanmessage') {
    return 'user';
  }
  return role;
}

export function buildAgentPromptSnapshot(input: {
  systemPrompt?: string;
  userMessage: string;
  history?: ChatMessage[];
}): PromptMessageSnapshot[] {
  const rows: PromptMessageSnapshot[] = [];
  const system = input.systemPrompt?.trim();
  if (system) rows.push({ role: 'system', content: system });
  for (const entry of input.history ?? []) {
    rows.push({
      role: normalizeChatMessageRole(entry.role),
      content: entry.content,
    });
  }
  rows.push({ role: 'user', content: input.userMessage });
  return rows;
}

/** Infer rxwf chat role from LangChain message instances or serialized payloads. */
export function summarizeLangChainMessageRole(message: unknown): string {
  if (!message || typeof message !== 'object') return 'message';
  const record = message as Record<string, unknown>;

  if (typeof record.role === 'string') {
    return normalizeChatMessageRole(record.role);
  }

  if (Array.isArray(record.id)) {
    const className = String(record.id[record.id.length - 1] ?? '');
    if (className.includes('AIMessage')) return 'assistant';
    if (className.includes('SystemMessage')) return 'system';
    if (className.includes('ToolMessage')) return 'tool';
    if (className.includes('HumanMessage')) return 'user';
  }

  const ctor = (message as { constructor?: { name?: string } }).constructor?.name;
  if (ctor && ctor !== 'Object') {
    if (ctor.includes('AIMessage')) return 'assistant';
    if (ctor.includes('SystemMessage')) return 'system';
    if (ctor.includes('ToolMessage')) return 'tool';
    if (ctor.includes('HumanMessage')) return 'user';
  }

  const raw =
    typeof (message as BaseMessage)._getType === 'function'
      ? (message as BaseMessage)._getType!()
      : String(record.type ?? 'message');
  return normalizeChatMessageRole(raw);
}

/** Map persisted agent memory rows to LangChain chat roles. */
export function chatHistoryToLangChainMessages(history: ChatMessage[]): BaseMessage[] {
  return history.map((entry) => {
    const role = normalizeMemoryRole(entry.role);
    if (role === 'system') return new SystemMessage(entry.content);
    if (role === 'assistant') return new AIMessage(entry.content);
    return new HumanMessage(entry.content);
  });
}
