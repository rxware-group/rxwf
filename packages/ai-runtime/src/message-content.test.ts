import { describe, expect, it } from 'vitest';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import type { ChatMessage } from '@rxwf/ai-runtime-stub';
import {
  chatHistoryToLangChainMessages,
  extractLangChainMessageText,
  lastAssistantAnswerFromMessages,
  listAssistantRoundTexts,
  resolveLlmResponsesForAgentRun,
  buildAgentPromptSnapshot,
  normalizeChatMessageRole,
  summarizeLangChainMessageRole,
} from './message-content.js';

describe('chatHistoryToLangChainMessages', () => {
  it('maps user and assistant memory roles to HumanMessage and AIMessage', () => {
    const messages = chatHistoryToLangChainMessages([
      { role: 'user', content: '你是谁？' },
      { role: 'assistant', content: '{"answer":"我是工程师"}' },
      { role: 'system', content: 'follow policy' },
    ]);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBeInstanceOf(HumanMessage);
    expect(messages[1]).toBeInstanceOf(AIMessage);
    expect(messages[2]?.constructor.name).toBe('SystemMessage');
  });

  it('accepts LangChain role aliases from persisted memory rows', () => {
    const messages = chatHistoryToLangChainMessages([
      { role: 'human', content: 'question' },
      { role: 'ai', content: 'answer' },
    ] as unknown as ChatMessage[]);
    expect(messages[0]).toBeInstanceOf(HumanMessage);
    expect(messages[1]).toBeInstanceOf(AIMessage);
  });

  it('buildAgentPromptSnapshot preserves assistant history roles', () => {
    const snapshot = buildAgentPromptSnapshot({
      systemPrompt: 'sys',
      userMessage: 'latest',
      history: [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
      ],
    });
    expect(snapshot.map((row) => row.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
  });

  it('summarizeLangChainMessageRole handles serialized LangChain messages', () => {
    const serialized = new AIMessage('answer').toJSON?.();
    expect(summarizeLangChainMessageRole(serialized)).toBe('assistant');
    expect(summarizeLangChainMessageRole({ role: 'human', content: 'x' })).toBe('user');
    expect(normalizeChatMessageRole('ai')).toBe('assistant');
  });
});

describe('extractLangChainMessageText', () => {
  it('returns string content as-is', () => {
    expect(extractLangChainMessageText('hello')).toBe('hello');
  });

  it('joins text blocks from content arrays', () => {
    expect(
      extractLangChainMessageText([{ type: 'text', text: '{"answer":"ok"}' }]),
    ).toBe('{"answer":"ok"}');
  });

  it('does not stringify empty arrays to empty answer by accident', () => {
    expect(extractLangChainMessageText([])).toBe('');
    expect(extractLangChainMessageText([{ type: 'text', text: 'x' }])).toBe('x');
  });
});

describe('listAssistantRoundTexts', () => {
  it('includes tool-call-only assistant turns before the final answer', () => {
    const messages = [
      new HumanMessage('hi'),
      new AIMessage({
        content: '',
        tool_calls: [{ id: 't1', name: 'search', args: { q: 'cpp' } }],
      }),
      new ToolMessage({ content: 'docs', tool_call_id: 't1' }),
      new AIMessage({ content: '{"answer":"final"}' }),
    ];
    expect(listAssistantRoundTexts(messages)).toEqual([
      JSON.stringify([{ tool: 'search', args: { q: 'cpp' } }]),
      '{"answer":"final"}',
    ]);
  });
});

describe('resolveLlmResponsesForAgentRun', () => {
  it('fills missing callback rounds from transcript without repeating the last answer', () => {
    const messages = [
      new AIMessage({
        content: '',
        tool_calls: [{ id: 't1', name: 'search', args: {} }],
      }),
      new AIMessage({ content: '{"answer":"final"}' }),
    ];
    expect(resolveLlmResponsesForAgentRun(['', ''], messages)).toEqual([
      JSON.stringify([{ tool: 'search', args: {} }]),
      '{"answer":"final"}',
    ]);
  });
});

describe('lastAssistantAnswerFromMessages', () => {
  it('uses the last AI message with text when the final message is a tool result', () => {
    const messages = [
      new HumanMessage('hi'),
      new AIMessage({ content: '{"answer":"from-ai"}' }),
      new ToolMessage({ content: 'tool output', tool_call_id: 't1' }),
      new AIMessage({ content: '' }),
    ];
    expect(lastAssistantAnswerFromMessages(messages)).toBe('{"answer":"from-ai"}');
  });
});
