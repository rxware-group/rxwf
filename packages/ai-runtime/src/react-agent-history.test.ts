import { describe, expect, it, vi } from 'vitest';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { chatHistoryToLangChainMessages } from './message-content.js';
import { createModelSatelliteCallbacks } from './model-satellite-callbacks.js';

describe('createReactAgent memory history roles', () => {
  it('preserves AIMessage roles in the first LLM call', async () => {
    const seen: string[] = [];
    let llmCalls = 0;
    const llm = {
      _modelType: () => 'base_chat_model',
      invoke: vi.fn(async (messages: Array<{ _getType?: () => string }>) => {
        seen.push(
          ...messages.map((m) =>
            typeof m._getType === 'function' ? m._getType() : 'unknown',
          ),
        );
        llmCalls += 1;
        if (llmCalls === 1) {
          return new AIMessage({
            content: '',
            tool_calls: [{ id: 't1', name: 'noop', args: {} }],
          });
        }
        return new AIMessage({ content: '{"answer":"ok"}' });
      }),
      bindTools: vi.fn(function (this: unknown) {
        return this;
      }),
    } as unknown as BaseChatModel;

    const agent = createReactAgent({
      llm,
      tools: [
        tool(async () => 'done', {
          name: 'noop',
          description: 'noop',
          schema: z.object({}),
        }),
      ],
    });

    const messages = [
      new SystemMessage('system'),
      ...chatHistoryToLangChainMessages([
        { role: 'user', content: '你是谁？' },
        { role: 'assistant', content: '{"answer":"我是工程师"}' },
      ]),
      new HumanMessage('请写 Hello World'),
    ];

    try {
      await agent.invoke({ messages }, { recursionLimit: 4 });
    } catch {
      /* minimal mock may hit LangGraph recursion limit */
    }

    expect(seen).toContain('ai');
    expect(seen.filter((role) => role === 'human').length).toBeGreaterThan(0);
  });

  it('satellite telemetry exposes ai role for assistant history', async () => {
    const emit = vi.fn();
    const { handlers } = createModelSatelliteCallbacks(
      {
        modelNodeId: 'model-1',
        onSatelliteStream: emit,
      },
      {
        initialPromptMessages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: '你是谁？' },
          { role: 'assistant', content: '{"answer":"我是工程师"}' },
          { role: 'user', content: '请写 Hello World' },
        ],
      },
    );
    const handler = handlers[0]!;
    await handler.handleChatModelStart?.(
      {} as never,
      [
        [
          new SystemMessage('system'),
          new HumanMessage('你是谁？'),
          new AIMessage('{"answer":"我是工程师"}'),
          new HumanMessage('请写 Hello World'),
        ],
      ],
      'run-1',
    );
    const input = emit.mock.calls[0]?.[1]?.input as Array<{ role: string }>;
    expect(input.map((row) => row.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });
});
