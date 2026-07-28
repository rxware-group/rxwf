import { describe, expect, it, vi } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import {
  parseGroupOrchestratorDecision,
  selectRoundRobinSpeaker,
  shouldTerminateByKeywords,
} from './group-chat-helpers.js';
import { createGroupChatExecutor } from './group-chat.js';

vi.mock('./run-ai-agent-node.js', () => ({
  runAiAgentNode: vi.fn(async (_ctx, _deps, opts) => ({
    status: 'success',
    outputItems: [[{ json: { answer: `reply-${opts.agentNodeId}` } }]],
  })),
}));

describe('groupChat registry', () => {
  it('throws E2003 when groupChat executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('groupChat', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered when createGroupChatExecutor is wired', () => {
    const registry = createExecutorRegistry();
    registry.register(createGroupChatExecutor({}));
    expect(registry.has('groupChat')).toBe(true);
  });
});

describe('selectRoundRobinSpeaker', () => {
  it('cycles members by round index', () => {
    expect(selectRoundRobinSpeaker(['A', 'B'], 1)).toBe('A');
    expect(selectRoundRobinSpeaker(['A', 'B'], 2)).toBe('B');
  });
});

describe('shouldTerminateByKeywords', () => {
  it('matches TERMINATE in content', () => {
    expect(shouldTerminateByKeywords('done TERMINATE', 'TERMINATE,FINISH')).toBe(true);
  });
});

describe('parseGroupOrchestratorDecision', () => {
  it('parses speak action', () => {
    const p = parseGroupOrchestratorDecision('{"action":"speak","member":"A"}');
    expect(p?.action).toBe('speak');
  });
});

describe('createGroupChatExecutor', () => {
  it('fails with E1048 when fewer than two group_member agents', async () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'gc-missing-members',
      nodes: [
        {
          id: 'gc',
          type: 'groupChat',
          name: 'Chat',
          position: { x: 0, y: 0 },
          parameters: { maxRounds: 2 },
        },
      ],
      connections: [],
    };
    const executor = createGroupChatExecutor({});
    const result = await executor.execute({
      config: { maxRounds: 2 },
      inputItems: [{ json: { task: 'review' } }],
      workflowDefinition: definition,
      nodeId: 'gc',
      executionId: 'exec-gc-missing',
      workflowId: 'wf-gc-missing',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1048');
  });

  it('native roundRobin alternates speakers each round (AC-035)', async () => {
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    vi.mocked(runAiAgentNode).mockClear();

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'gc-round-robin',
      nodes: [
        {
          id: 'gc',
          type: 'groupChat',
          name: 'Chat',
          position: { x: 0, y: 0 },
          parameters: { maxRounds: 4, speakerSelection: 'roundRobin' },
        },
        { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: { role: 'A' } },
        { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: { role: 'B' } },
        {
          id: 'm1',
          type: 'aiChatModel',
          name: 'M1',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'm2',
          type: 'aiChatModel',
          name: 'M2',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };

    const executor = createGroupChatExecutor({
      ai: {
        chat: async function* () {},
        runAgent: async () => ({ items: [{ json: { answer: 'x' } }] }),
        runGroupChat: async () => ({
          status: 'success',
          answer: '',
          transcript: [],
          groupChatSteps: [],
        }),
      },
    });

    const result = await executor.execute({
      config: {
        maxRounds: 4,
        speakerSelection: 'roundRobin',
        executionBackend: 'native',
      },
      inputItems: [{ json: { task: 'debate topic' } }],
      workflowDefinition: definition,
      nodeId: 'gc',
      executionId: 'exec-gc-rr',
      workflowId: 'wf-gc-rr',
    });

    expect(result.status).toBe('success');
    expect(runAiAgentNode).toHaveBeenCalledTimes(4);

    const agentIds = vi.mocked(runAiAgentNode).mock.calls.map((call) => call[2].agentNodeId);
    expect(agentIds).toEqual(['a1', 'a2', 'a1', 'a2']);

    const json = result.outputItems?.[0]?.[0]?.json as Record<string, unknown>;
    const transcript = json.transcript as Array<{ author: string; round: number }>;
    expect(transcript.map((t) => t.author)).toEqual(['A', 'B', 'A', 'B']);
    expect(transcript.map((t) => t.round)).toEqual([1, 2, 3, 4]);
  });

  it('runs round-robin group chat', async () => {
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    vi.mocked(runAiAgentNode).mockClear();

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'gc',
      nodes: [
        {
          id: 'gc',
          type: 'groupChat',
          name: 'Chat',
          position: { x: 0, y: 0 },
          parameters: { maxRounds: 2 },
        },
        { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: { role: 'A' } },
        { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: { role: 'B' } },
        {
          id: 'm1',
          type: 'aiChatModel',
          name: 'M1',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'm2',
          type: 'aiChatModel',
          name: 'M2',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };

    const executor = createGroupChatExecutor({
      ai: {
        chat: async function* () {},
        runAgent: async () => ({ items: [{ json: { answer: 'x' } }] }),
        runGroupChat: async () => ({
          status: 'success',
          answer: '',
          transcript: [],
          groupChatSteps: [],
        }),
      },
    });
    const result = await executor.execute({
      config: { maxRounds: 2 },
      inputItems: [{ json: { task: 'review plan' } }],
      workflowDefinition: definition,
      nodeId: 'gc',
      executionId: 'exec-gc',
      workflowId: 'wf-gc',
      parentExecutionId: 'exec-gc',
    });

    expect(result.status).toBe('success');
    expect(runAiAgentNode).toHaveBeenCalledTimes(2);
    const json = result.outputItems?.[0]?.[0]?.json as Record<string, unknown>;
    expect(Array.isArray(json.transcript)).toBe(true);
    expect((json.transcript as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(
      result.metadata?.agentSteps?.some(
        (s) => (s as { output?: { type?: string } }).output?.type === 'groupChatTurn',
      ),
    ).toBe(true);
  });

  it('delegates to ai.runGroupChat when executionBackend is langgraph', async () => {
    const { createGroupChatExecutor } = await import('./group-chat.js');
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    vi.mocked(runAiAgentNode).mockClear();
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'gc-lg',
      nodes: [
        {
          id: 'gc',
          type: 'groupChat',
          name: 'Chat',
          position: { x: 0, y: 0 },
          parameters: { maxRounds: 2, executionBackend: 'langgraph' },
        },
        { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: { role: 'A' } },
        { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: { role: 'B' } },
        {
          id: 'm1',
          type: 'aiChatModel',
          name: 'M1',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'm2',
          type: 'aiChatModel',
          name: 'M2',
          position: { x: 0, y: 0 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };

    const runGroupChat = vi.fn(async (input) => {
      await input.invokeParticipant({
        participantId: 'a1',
        task: input.task,
        transcript: [],
        round: 1,
      });
      await input.invokeParticipant({
        participantId: 'a2',
        task: input.task,
        transcript: [],
        round: 2,
      });
      return {
        status: 'success' as const,
        answer: 'langgraph answer',
        transcript: [
          {
            author: 'A',
            authorNodeId: 'a1',
            role: 'agent' as const,
            content: 'r1',
            round: 1,
            at: new Date().toISOString(),
          },
        ],
        groupChatSteps: [{ type: 'groupChatTurn' as const, round: 1, speaker: 'A', content: 'r1' }],
      };
    });

    const executor = createGroupChatExecutor({
      ai: {
        chat: async function* () {},
        runAgent: async () => ({ items: [{ json: { answer: 'x' } }] }),
        runGroupChat,
      },
    });
    const result = await executor.execute({
      config: { maxRounds: 2, executionBackend: 'langgraph' },
      inputItems: [{ json: { task: 'review plan' } }],
      workflowDefinition: definition,
      nodeId: 'gc',
      executionId: 'exec-gc-lg',
      workflowId: 'wf-gc-lg',
    });

    expect(runGroupChat).toHaveBeenCalledTimes(1);
    expect(runAiAgentNode).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
    const json = result.outputItems?.[0]?.[0]?.json as Record<string, unknown>;
    expect(json.executionBackend).toBe('langgraph');
    expect(json.answer).toBe('langgraph answer');
  });
});
