import { describe, expect, it } from 'vitest';
import { AwfError } from '@rxwf/shared';
import {
  applyGroupChatUserProxyResumeToCheckpoint,
  buildGroupChatUserProxyOrchestrationResume,
  buildGroupChatUserProxyWaitingMetadata,
  parseGroupChatUserProxyCheckpoint,
} from '../../../../packages/execution/src/hitl/group-chat-user-proxy.js';

const waitingCheckpoint = {
  transcript: [
    {
      author: 'Analyst',
      authorNodeId: 'agent-a',
      role: 'agent' as const,
      content: 'Initial analysis',
      round: 1,
      at: '2026-06-20T10:00:00.000Z',
    },
  ],
  round: 2,
  task: 'Assess deployment options',
  memberIds: ['agent-a', 'agent-b'],
};

describe('hitl resume group chat UserProxy path', () => {
  it('waiting node metadata round-trips checkpoint for resume handler', () => {
    const waitingMeta = buildGroupChatUserProxyWaitingMetadata(
      { userProxyEnabled: true, userProxyEveryNRounds: 1 },
      waitingCheckpoint,
    );
    const parsed = parseGroupChatUserProxyCheckpoint(waitingMeta);
    expect(parsed).toEqual(waitingCheckpoint);
    expect(waitingMeta.hitl.allowSupplement).toBe(true);
  });

  it('resume without append user message should fail before orchestration resume', () => {
    expect(() =>
      buildGroupChatUserProxyOrchestrationResume(waitingCheckpoint, {
        decision: 'approve',
        supplement: '',
      }),
    ).toThrow(AwfError);
    expect(() =>
      applyGroupChatUserProxyResumeToCheckpoint(waitingCheckpoint, ''),
    ).toThrow(/append user message/);
  });

  it('approve supplement produces checkpoint with appended user message', () => {
    const resume = buildGroupChatUserProxyOrchestrationResume(waitingCheckpoint, {
      decision: 'approve',
      supplement: 'Prefer on-prem deployment',
    });
    const resumedCheckpoint = applyGroupChatUserProxyResumeToCheckpoint(
      resume.checkpoint,
      resume.userMessage,
    );
    expect(
      resumedCheckpoint.transcript.some(
        (m) => m.role === 'user' && m.content.includes('on-prem'),
      ),
    ).toBe(true);
    expect(resumedCheckpoint.transcript.length).toBe(
      waitingCheckpoint.transcript.length + 1,
    );
  });
});
