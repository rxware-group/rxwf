import { describe, expect, it, vi } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createLangChainAiRuntime } from './langchain-runtime.js';
import { buildAgentPromptSnapshot } from './message-content.js';

function mockChatModel(reply: string): BaseChatModel {
  return {
    invoke: async () => ({ content: reply }),
    stream: async function* () {
      yield { content: reply };
    },
  } as unknown as BaseChatModel;
}

describe('createLangChainAiRuntime', () => {
  it('runAgent returns answer without tools', async () => {
    const rt = createLangChainAiRuntime({
      createChatModel: () => mockChatModel('hello agent'),
    });
    const result = await rt.runAgent(
      {
        model: { provider: 'ollama', model: 'test' },
        userMessage: 'Hi',
        tools: [],
        maxIterations: 5,
        timeoutMs: 30_000,
      },
      {
        executionId: 'e1',
        workflowId: 'w1',
        nodeId: 'n1',
        environment: 'test',
      },
    );
    expect(result.items[0]?.json.answer).toBe('hello agent');
  });

  it('runAgent appends output schema hint once when outputSchema is set', async () => {
    const invoke = vi.fn(async (messages: Array<{ content: string }>) => {
      const system = messages.find((m) => typeof m.content === 'string' && m.content.includes('C++'));
      const text = system?.content ?? '';
      expect(text.match(/You must respond with valid JSON/g)?.length).toBe(1);
      expect(text).toContain('你是C++开发工程师');
      return { content: '{"answer":"ok"}' };
    });
    const rt = createLangChainAiRuntime({
      createChatModel: () =>
        ({
          invoke,
        }) as unknown as BaseChatModel,
    });
    await rt.runAgent(
      {
        model: { provider: 'ollama', model: 'test' },
        systemPrompt: '你是C++开发工程师',
        userMessage: 'Hi',
        tools: [],
        maxIterations: 5,
        timeoutMs: 30_000,
        outputSchema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
        },
      },
      {
        executionId: 'e1',
        workflowId: 'w1',
        nodeId: 'n1',
        environment: 'test',
      },
    );
    expect(invoke).toHaveBeenCalled();
  });

  it('runAgent maps memory history assistant rows to AIMessage', async () => {
    const invoke = vi.fn(async (messages: Array<{ constructor: { name: string } }>) => {
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[1]).toBeInstanceOf(AIMessage);
      expect(messages[2]).toBeInstanceOf(HumanMessage);
      return { content: 'follow-up' };
    });
    const rt = createLangChainAiRuntime({
      createChatModel: () =>
        ({
          invoke,
        }) as unknown as BaseChatModel,
    });
    await rt.runAgent(
      {
        model: { provider: 'ollama', model: 'test' },
        userMessage: '你是谁？',
        history: [
          { role: 'user', content: '请写 Hello World' },
          { role: 'assistant', content: '{"answer":"已给出示例"}' },
        ],
        tools: [],
        maxIterations: 5,
        timeoutMs: 30_000,
      },
      {
        executionId: 'e1',
        workflowId: 'w1',
        nodeId: 'n1',
        environment: 'test',
      },
    );
    expect(invoke).toHaveBeenCalled();
  });

  it('runAgent with tools preserves assistant memory rows in model telemetry', async () => {
    const snapshot = buildAgentPromptSnapshot({
      userMessage: '是否支持Mate X？',
      history: [
        { role: 'user', content: '你是谁？' },
        { role: 'assistant', content: '{"answer":"我是工程师"}' },
      ],
    });
    expect(snapshot.map((row) => row.role)).toContain('assistant');

    const emit = vi.fn<(satelliteNodeId: string, chunk: { type: string; input?: unknown }) => void>();
    const invokeRoles: string[][] = [];
    let llmCalls = 0;
    const llm = {
      _modelType: () => 'base_chat_model',
      invoke: vi.fn(async (messages: Array<{ _getType?: () => string }>) => {
        invokeRoles.push(
          messages.map((m) =>
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

    const rt = createLangChainAiRuntime({
      createChatModel: () => llm,
    });

    try {
      await rt.runAgent(
        {
          model: { provider: 'ollama', model: 'test' },
          userMessage: '是否支持Mate X？',
          history: [
            { role: 'user', content: '你是谁？' },
            { role: 'assistant', content: '{"answer":"我是工程师"}' },
          ],
          tools: [
            {
              name: 'noop',
              description: 'noop',
              parameters: { type: 'object', properties: {} },
              source: { type: 'builtin', name: 'noop' },
            },
          ],
          maxIterations: 2,
          timeoutMs: 30_000,
          invokeTool: async () => 'done',
        },
        {
          executionId: 'e1',
          workflowId: 'w1',
          nodeId: 'n1',
          environment: 'test',
          modelNodeId: 'model-1',
          onSatelliteStream: emit,
        },
      );
    } catch {
      /* minimal mock may hit LangGraph recursion limit */
    }

    expect(invokeRoles[0]).toContain('ai');
  });

  it('runAgent with timeoutMs <= 0 does not pass abort signal to model', async () => {
    const invoke = vi.fn(async (_messages: unknown, opts?: { signal?: AbortSignal }) => {
      expect(opts?.signal).toBeUndefined();
      return { content: 'no timeout' };
    });
    const rt = createLangChainAiRuntime({
      createChatModel: () =>
        ({
          invoke,
        }) as unknown as BaseChatModel,
    });
    const result = await rt.runAgent(
      {
        model: { provider: 'ollama', model: 'test' },
        userMessage: 'Hi',
        tools: [],
        maxIterations: 5,
        timeoutMs: -1,
      },
      {
        executionId: 'e1',
        workflowId: 'w1',
        nodeId: 'n1',
        environment: 'test',
      },
    );
    expect(result.items[0]?.json.answer).toBe('no timeout');
    expect(invoke).toHaveBeenCalled();
  });

  it('chat yields multiple tokens from model.stream', async () => {
    const runtime = createLangChainAiRuntime({
      createChatModel: () =>
        ({
          stream: async function* () {
            yield { content: 'Hello' };
            yield { content: ' world' };
          },
        }) as unknown as BaseChatModel,
    });
    const tokens: string[] = [];
    for await (const t of runtime.chat([{ role: 'user', content: 'hi' }])) tokens.push(t);
    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('chat yields model text', async () => {
    const rt = createLangChainAiRuntime({
      createChatModel: () => mockChatModel('chat ok'),
    });
    const chunks: string[] = [];
    for await (const t of rt.chat([{ role: 'user', content: 'x' }])) {
      chunks.push(t);
    }
    expect(chunks.join('')).toBe('chat ok');
  });

  it('chat uses ollama defaultModel when opts.model is omitted', async () => {
    const seen: Array<{ provider: string; model: string }> = [];
    const rt = createLangChainAiRuntime({
      ollama: { baseUrl: 'http://127.0.0.1:11434', defaultModel: 'qwen3:8b' },
      createChatModel: (modelRef) => {
        seen.push({ provider: modelRef.provider, model: modelRef.model });
        return mockChatModel('ok');
      },
    });
    for await (const _ of rt.chat([{ role: 'user', content: 'hi' }])) {
      /* drain */
    }
    expect(seen).toEqual([{ provider: 'ollama', model: 'qwen3:8b' }]);
  });

  it('chat prefers opts.model over defaultModel', async () => {
    const seen: string[] = [];
    const rt = createLangChainAiRuntime({
      ollama: { baseUrl: 'http://127.0.0.1:11434', defaultModel: 'llama3' },
      createChatModel: (modelRef) => {
        seen.push(modelRef.model);
        return mockChatModel('ok');
      },
    });
    for await (const _ of rt.chat(
      [{ role: 'user', content: 'hi' }],
      { model: { provider: 'ollama', model: 'mistral' } },
    )) {
      /* drain */
    }
    expect(seen).toEqual(['mistral']);
  });

  it('runGroupChat delegates to LangGraph round-robin loop', async () => {
    const rt = createLangChainAiRuntime({
      createChatModel: () => mockChatModel('unused'),
    });
    const invokeParticipant = vi.fn(async ({ participantId }: { participantId: string }) => ({
      content: `from ${participantId}`,
    }));
    const result = await rt.runGroupChat(
      {
        task: 'Discuss',
        participants: [
          { id: 'a1', name: 'A', role: 'A' },
          { id: 'a2', name: 'B', role: 'B' },
        ],
        speakerSelection: 'roundRobin',
        maxRounds: 2,
        terminationKeywords: 'TERMINATE',
        invokeParticipant,
      },
      {
        executionId: 'e1',
        workflowId: 'w1',
        nodeId: 'gc',
        environment: 'test',
      },
    );
    expect(result.status).toBe('success');
    expect(invokeParticipant).toHaveBeenCalledTimes(2);
    expect(result.transcript).toHaveLength(2);
  });
});
