import { describe, expect, it, vi } from 'vitest';
import type { GroupChatRunInput } from '@rxwf/ai-runtime-stub';
import {
  formatGroupChatTranscriptMarkdown,
  runGroupChatGraph,
} from './group-chat-agent.js';

function baseInput(
  overrides: Partial<GroupChatRunInput> = {},
): GroupChatRunInput {
  return {
    task: 'Review the plan',
    participants: [
      { id: 'a1', name: 'Analyst', role: 'Analyst' },
      { id: 'a2', name: 'Reviewer', role: 'Reviewer' },
    ],
    speakerSelection: 'roundRobin',
    maxRounds: 2,
    terminationKeywords: 'TERMINATE,FINISH',
    invokeParticipant: vi.fn(async ({ participantId }) => ({
      content: `reply from ${participantId}`,
    })),
    ...overrides,
  };
}

describe('group-chat graph entry', () => {
  it('exports runGroupChatGraph as the LangGraph adapter entry', async () => {
    const mod = await import('./group-chat-agent.js');
    expect(mod.runGroupChatGraph).toBeTypeOf('function');
  });
});

describe('runGroupChatGraph', () => {
  it('fails with E1048 when fewer than two participants', async () => {
    const result = await runGroupChatGraph(
      baseInput({
        participants: [{ id: 'solo', name: 'Solo', role: 'Solo' }],
      }),
      { chatOrchestrator: async () => '{"action":"finish","answer":"x"}' },
    );
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1048');
  });

  it('runs round-robin for maxRounds turns', async () => {
    const invokeParticipant = vi.fn(async ({ participantId }) => ({
      content: `reply from ${participantId}`,
    }));
    const result = await runGroupChatGraph(
      baseInput({ invokeParticipant }),
      { chatOrchestrator: async () => '{"action":"finish","answer":"x"}' },
    );

    expect(result.status).toBe('success');
    expect(invokeParticipant).toHaveBeenCalledTimes(2);
    expect(result.transcript.length).toBe(2);
    expect(result.groupChatSteps.filter((s) => s.type === 'groupChatTurn')).toHaveLength(2);
  });

  it('terminates early when keyword matches', async () => {
    const invokeParticipant = vi.fn(async () => ({ content: 'done TERMINATE now' }));
    const result = await runGroupChatGraph(
      baseInput({ maxRounds: 5, invokeParticipant }),
      { chatOrchestrator: async () => '{"action":"finish","answer":"x"}' },
    );

    expect(result.status).toBe('success');
    expect(invokeParticipant).toHaveBeenCalledTimes(1);
    expect(result.groupChatSteps.some((s) => s.type === 'groupChatFinish')).toBe(true);
  });

  it('orchestrator finish returns consolidated answer', async () => {
    const chatOrchestrator = vi.fn(async () =>
      JSON.stringify({ action: 'finish', answer: 'orchestrator final' }),
    );
    const result = await runGroupChatGraph(
      baseInput({
        speakerSelection: 'orchestrator',
        orchestratorModel: { provider: 'ollama', model: 'llama3' },
      }),
      { chatOrchestrator },
    );

    expect(chatOrchestrator).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.answer).toBe('orchestrator final');
  });

  it('formats transcript markdown when requested', async () => {
    const result = await runGroupChatGraph(
      baseInput({ returnTranscriptMarkdown: true, maxRounds: 1 }),
      { chatOrchestrator: async () => '{"action":"finish","answer":"x"}' },
    );
    expect(result.transcriptMarkdown).toContain('### Analyst');
    expect(formatGroupChatTranscriptMarkdown(result.transcript)).toBe(result.transcriptMarkdown);
  });
});
