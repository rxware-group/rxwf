import { describe, expect, it, vi } from 'vitest';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';

vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: ({ tools }: { tools: Array<{ invoke: (a: unknown) => Promise<unknown> }> }) => ({
    invoke: async () => {
      await tools[0]!.invoke({});
      return { messages: [{ content: 'done' }] };
    },
  }),
}));

function mockChatModel(): BaseChatModel {
  return {
    invoke: async () => ({ content: 'agent' }),
    stream: async function* () {
      yield { content: 'agent' };
    },
  } as unknown as BaseChatModel;
}

describe('createLangChainAiRuntime tool errors', () => {
  it('emits failed agent_step when invokeTool throws', async () => {
    const { createLangChainAiRuntime } = await import('./langchain-runtime.js');
    const chunks: AiStreamChunk[] = [];
    const rt = createLangChainAiRuntime({
      createChatModel: () => mockChatModel(),
    });

    await expect(
      rt.runAgent(
        {
          model: { provider: 'ollama', model: 'test' },
          userMessage: 'run tool',
          tools: [
            {
              name: 'FailTool',
              description: 'fails',
              parameters: { type: 'object', properties: {} },
              source: { type: 'mcp', serverId: 's', toolName: 'fail' },
            },
          ],
          invokeTool: async () => {
            throw new Error('tool boom');
          },
          maxIterations: 5,
          timeoutMs: 30_000,
        },
        {
          executionId: 'e1',
          workflowId: 'w1',
          nodeId: 'n1',
          environment: 'test',
          onStream: (c) => chunks.push(c),
        },
      ),
    ).rejects.toMatchObject({ code: 'E3012' });

    expect(chunks.some((c) => c.type === 'agent_step')).toBe(true);
  });
});
