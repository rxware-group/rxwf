import { describe, expect, it, vi } from 'vitest';
import type { AwfCrewIrV1 } from '@rxwf/workflow';
import type { AgentMemoryRepository } from '@rxwf/providers-contracts';
import { enrichCrewIrWithMemory, persistCrewMemory } from './crew-memory-bridge.js';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';

function mockAgentMemory(
  overrides: Partial<AgentMemoryRepository>,
): AgentMemoryRepository {
  return {
    listRecent: vi.fn(async () => []),
    append: vi.fn(async (input) => ({
      id: 'mock-id',
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      executionId: input.executionId,
      createdAt: new Date(),
    })),
    listSessions: vi.fn(async () => ({ items: [], total: 0 })),
    listAllMessages: vi.fn(async () => []),
    deleteSession: vi.fn(async () => 0),
    deleteMessage: vi.fn(async () => false),
    ...overrides,
  };
}

function baseIr(): AwfCrewIrV1 {
  return {
    irVersion: 1,
    process: 'sequential',
    executionBackend: 'crewai',
    inputTask: 'hello',
    crewParams: {},
    members: [
      {
        nodeId: 'a1',
        name: 'Writer',
        model: { provider: 'ollama', model: 'llama3' },
        tools: [],
        memory: { sessionId: 'sess-1', maxTurns: 10 },
      },
    ],
    execution: {
      executionId: 'ex-1',
      workflowId: 'wf-1',
      crewNodeId: 'crew',
      environment: 'test',
      toolBridgeBaseUrl: 'http://127.0.0.1:8787',
      toolBridgeToken: '',
    },
  };
}

const ctx: NodeExecutionContext = {
  config: {},
  inputItems: [{ json: { topic: 'AI' } }],
  executionId: 'ex-1',
};

describe('crew-memory-bridge', () => {
  it('enrichCrewIrWithMemory injects history from agentMemory', async () => {
    const ir = baseIr();
    const deps: PlusExecutorDeps = {
      agentMemory: mockAgentMemory({
        listRecent: vi.fn(async () => [
          {
            id: '1',
            sessionId: 'sess-1',
            role: 'user' as const,
            content: 'prior question',
            createdAt: new Date(),
          },
          {
            id: '2',
            sessionId: 'sess-1',
            role: 'assistant' as const,
            content: 'prior answer',
            createdAt: new Date(),
          },
        ]),
      }),
    };

    await enrichCrewIrWithMemory(ir, ctx, deps);

    expect(ir.members[0]?.memory?.history).toEqual([
      { role: 'user', content: 'prior question' },
      { role: 'assistant', content: 'prior answer' },
    ]);
  });

  it('persistCrewMemory appends user and assistant turns', async () => {
    const ir = baseIr();
    const append = vi.fn(async () => ({
      id: 'x',
      sessionId: 'sess-1',
      role: 'user' as const,
      content: '',
      createdAt: new Date(),
    }));
    const deps: PlusExecutorDeps = {
      agentMemory: mockAgentMemory({ listRecent: vi.fn(async () => []), append }),
    };

    await persistCrewMemory(ir, ctx, deps, 'hello', 'world');

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(1, {
      sessionId: 'sess-1',
      role: 'user',
      content: 'hello',
      executionId: 'ex-1',
    });
    expect(append).toHaveBeenNthCalledWith(2, {
      sessionId: 'sess-1',
      role: 'assistant',
      content: 'world',
      executionId: 'ex-1',
    });
  });
});
