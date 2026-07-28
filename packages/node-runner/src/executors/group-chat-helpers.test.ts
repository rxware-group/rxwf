import { describe, expect, it } from 'vitest';
import { AwfError } from '@rxwf/shared';
import {
  buildGroupChatFinishStep,
  buildGroupChatTurnStep,
  buildGroupChatUserProxyStep,
  toGroupChatAgentStepRecords,
  validateGroupChatAgentSteps,
  type GroupChatStepRecord,
} from './group-chat-helpers.js';

describe('buildGroupChatUserProxyStep', () => {
  it('creates a groupChatUserProxy audit record', () => {
    const step = buildGroupChatUserProxyStep(2, '请输入纠偏或补充…');
    expect(step).toEqual({
      type: 'groupChatUserProxy',
      round: 2,
      content: '请输入纠偏或补充…',
    });
  });
});

describe('toGroupChatAgentStepRecords', () => {
  it('wraps group chat steps as agent_step records', () => {
    const steps: GroupChatStepRecord[] = [
      buildGroupChatTurnStep({ round: 1, speaker: 'A', content: 'hi' }),
    ];
    const records = toGroupChatAgentStepRecords(steps);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      type: 'agent_step',
      status: 'success',
      output: { type: 'groupChatTurn', round: 1, speaker: 'A', content: 'hi' },
    });
  });
});

describe('validateGroupChatAgentSteps', () => {
  it('fails when groupChatUserProxy step is missing for a user-proxy round', () => {
    const steps: GroupChatStepRecord[] = [
      buildGroupChatTurnStep({ round: 1, speaker: 'A', content: 'hello' }),
      buildGroupChatFinishStep(2, 'done'),
    ];

    expect(() =>
      validateGroupChatAgentSteps(steps, { userProxyRounds: [2] }),
    ).toThrow(AwfError);
    expect(() =>
      validateGroupChatAgentSteps(steps, { userProxyRounds: [2] }),
    ).toThrow(/groupChatUserProxy/);
  });

  it('passes when each user-proxy round has a groupChatUserProxy step', () => {
    const steps: GroupChatStepRecord[] = [
      buildGroupChatTurnStep({ round: 1, speaker: 'A', content: 'hello' }),
      buildGroupChatUserProxyStep(2, 'user input needed'),
      buildGroupChatTurnStep({ round: 2, speaker: 'B', content: 'after user' }),
      buildGroupChatFinishStep(2, 'after user'),
    ];

    expect(() =>
      validateGroupChatAgentSteps(steps, { userProxyRounds: [2] }),
    ).not.toThrow();
  });
});
