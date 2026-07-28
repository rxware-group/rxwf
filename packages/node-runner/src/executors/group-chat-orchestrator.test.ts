import { describe, expect, it, vi } from 'vitest';
import type { WorkflowNode } from '@rxwf/workflow';
import {
  detectOrchestratorDeadLoop,
  runGroupChatOrchestratorLoop,
} from './group-chat-orchestrator.js';

const members: WorkflowNode[] = [
  { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: { role: 'A' } },
  { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: { role: 'B' } },
];

describe('detectOrchestratorDeadLoop', () => {
  it('detects dead loop when max rounds exceeded without orchestrator finish', () => {
    expect(detectOrchestratorDeadLoop(4, 3, false)).toBe(true);
    expect(detectOrchestratorDeadLoop(3, 3, false)).toBe(false);
    expect(detectOrchestratorDeadLoop(4, 3, true)).toBe(false);
  });
});

describe('runGroupChatOrchestratorLoop', () => {
  it('fails dead loop detection when orchestrator never returns finish', async () => {
    const askOrchestrator = vi.fn(async () => ({
      action: 'speak' as const,
      member: 'A',
      reason: 'keep talking',
    }));
    const invokeParticipant = vi.fn(async () => ({ content: 'still discussing' }));

    const result = await runGroupChatOrchestratorLoop({
      members,
      task: 'review plan',
      maxRounds: 3,
      terminationKeywords: 'TERMINATE,FINISH,完成',
      askOrchestrator,
      invokeParticipant,
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errorCode).toBe('E1050');
      expect(result.errorMessage).toMatch(/finish/i);
    }
    expect(askOrchestrator).toHaveBeenCalledTimes(3);
    expect(invokeParticipant).toHaveBeenCalledTimes(3);
  });

  it('succeeds when orchestrator returns finish', async () => {
    const askOrchestrator = vi.fn(async () => ({
      action: 'finish' as const,
      answer: 'consolidated answer',
    }));

    const result = await runGroupChatOrchestratorLoop({
      members,
      task: 'review plan',
      maxRounds: 5,
      askOrchestrator,
      invokeParticipant: vi.fn(async () => ({ content: 'unused' })),
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.answer).toBe('consolidated answer');
      expect(result.groupChatSteps.some((s) => s.type === 'groupChatFinish')).toBe(true);
    }
    expect(askOrchestrator).toHaveBeenCalledTimes(1);
  });

  it('succeeds when orchestrator picks speak then finish', async () => {
    let call = 0;
    const askOrchestrator = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return { action: 'speak' as const, member: 'a1', reason: 'start' };
      }
      return { action: 'finish' as const, answer: 'done after one turn' };
    });
    const invokeParticipant = vi.fn(async () => ({ content: 'first reply' }));

    const result = await runGroupChatOrchestratorLoop({
      members,
      task: 'brainstorm',
      maxRounds: 5,
      askOrchestrator,
      invokeParticipant,
    });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.answer).toBe('done after one turn');
      expect(result.transcript).toHaveLength(1);
    }
    expect(invokeParticipant).toHaveBeenCalledTimes(1);
    expect(askOrchestrator).toHaveBeenCalledTimes(2);
  });
});
