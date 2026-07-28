import { describe, expect, it } from 'vitest';
import { AwfError } from '@rxwf/shared';
import {
  appendUserProxyMessage,
  assertUserMessageAppendedOnResume,
  buildGroupChatUserProxyOrchestrationResume,
  buildGroupChatUserProxyWaitingMetadata,
  parseGroupChatUserProxyCheckpoint,
  validateGroupChatUserProxyResume,
} from './group-chat-user-proxy.js';

const sampleCheckpoint = {
  transcript: [
    {
      author: 'A',
      authorNodeId: 'a1',
      role: 'agent' as const,
      content: 'first turn',
      round: 1,
      at: '2026-06-20T00:00:00.000Z',
    },
  ],
  round: 2,
  task: 'review design',
  memberIds: ['a1', 'a2'],
};

describe('groupChat UserProxy waiting metadata', () => {
  it('builds waiting metadata with checkpoint and supplement flag', () => {
    const meta = buildGroupChatUserProxyWaitingMetadata(
      { userProxyPrompt: 'Please review' },
      sampleCheckpoint,
    );
    expect(meta.hitl.prompt).toBe('Please review');
    expect(meta.hitl.allowReject).toBe(false);
    expect(meta.hitl.allowSupplement).toBe(true);
    expect(meta.groupChat.checkpoint).toEqual(sampleCheckpoint);
  });

  it('parses checkpoint from waiting node metadata', () => {
    const parsed = parseGroupChatUserProxyCheckpoint({
      hitl: { prompt: 'x' },
      groupChat: { checkpoint: sampleCheckpoint },
    });
    expect(parsed).toEqual(sampleCheckpoint);
  });
});

describe('groupChat UserProxy resume validation (AC-037)', () => {
  it('resume without append user message should fail', () => {
    expect(() =>
      validateGroupChatUserProxyResume({ decision: 'approve', supplement: '' }),
    ).toThrow(AwfError);
    expect(() =>
      validateGroupChatUserProxyResume({ decision: 'approve', supplement: '   ' }),
    ).toThrow(/append user message/);
    expect(() =>
      buildGroupChatUserProxyOrchestrationResume(sampleCheckpoint, {
        decision: 'approve',
        supplement: '',
      }),
    ).toThrow(AwfError);
  });

  it('assertUserMessageAppendedOnResume fails when transcript unchanged', () => {
    expect(() =>
      assertUserMessageAppendedOnResume(sampleCheckpoint, sampleCheckpoint, 'security'),
    ).toThrow(/did not append user message/);
  });

  it('approve resume with supplement builds orchestration resume payload', () => {
    const resume = buildGroupChatUserProxyOrchestrationResume(sampleCheckpoint, {
      decision: 'approve',
      supplement: 'focus on security risks',
    });
    expect(resume).toEqual({
      kind: 'groupChat',
      checkpoint: sampleCheckpoint,
      userMessage: 'focus on security risks',
    });
  });

  it('appendUserProxyMessage adds user role entry at current round', () => {
    const after = appendUserProxyMessage(sampleCheckpoint, 'focus on security risks');
    expect(after.transcript).toHaveLength(sampleCheckpoint.transcript.length + 1);
    const userMsg = after.transcript.at(-1);
    expect(userMsg).toMatchObject({
      author: 'User',
      authorNodeId: 'user',
      role: 'user',
      content: 'focus on security risks',
      round: sampleCheckpoint.round,
    });
    expect(() =>
      assertUserMessageAppendedOnResume(
        sampleCheckpoint,
        after,
        'focus on security risks',
      ),
    ).not.toThrow();
  });

  it('reject decision does not require supplement', () => {
    expect(() =>
      validateGroupChatUserProxyResume({ decision: 'reject', supplement: '' }),
    ).not.toThrow();
  });
});
