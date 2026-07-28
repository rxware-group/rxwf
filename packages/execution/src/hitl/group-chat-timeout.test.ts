import { describe, expect, it, vi } from 'vitest';
import {
  buildGroupChatUserProxyTimeoutFailure,
  buildUserProxyTimeoutHitlFields,
  GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT,
  isGroupChatUserProxyWaitingExpired,
  resolveUserProxyTimeoutMs,
  runGroupChatUserProxyTimeoutSweepOnce,
  shouldSweepGroupChatUserProxyWaiting,
} from './group-chat-timeout.js';

const sampleCheckpoint = {
  transcript: [],
  round: 1,
  task: 'review',
  memberIds: ['a1', 'a2'],
};

describe('groupChat UserProxy timeout config', () => {
  it('defaults userProxyTimeoutMs to -1 (no timeout)', () => {
    expect(resolveUserProxyTimeoutMs({})).toBe(-1);
    expect(resolveUserProxyTimeoutMs({ userProxyTimeoutMs: -1 })).toBe(-1);
    expect(GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT).toBe(-1);
  });

  it('buildUserProxyTimeoutHitlFields omits expiresAt when timeout is -1', () => {
    expect(buildUserProxyTimeoutHitlFields({ userProxyTimeoutMs: -1 })).toEqual({});
    expect(buildUserProxyTimeoutHitlFields({})).toEqual({});
  });

  it('buildUserProxyTimeoutHitlFields sets expiresAt when timeout > 0', () => {
    const fields = buildUserProxyTimeoutHitlFields(
      { userProxyTimeoutMs: 5000 },
      Date.parse('2026-06-20T12:00:00.000Z'),
    );
    expect(fields.userProxyTimeoutMs).toBe(5000);
    expect(fields.userProxyTimeoutAction).toBe('fail');
    expect(fields.requestedAt).toBe('2026-06-20T12:00:00.000Z');
    expect(fields.expiresAt).toBe('2026-06-20T12:00:05.000Z');
  });
});

describe('groupChat UserProxy timeout sweeper (AC-037)', () => {
  it('default -1 does not trigger sweeper', async () => {
    const metadata = {
      hitl: { prompt: '请输入', allowReject: false, allowSupplement: true },
      groupChat: { checkpoint: sampleCheckpoint },
    };
    expect(shouldSweepGroupChatUserProxyWaiting(metadata)).toBe(false);

    const failUserProxyTimeout = vi.fn();
    const resolved = await runGroupChatUserProxyTimeoutSweepOnce({
      listWaitingExecutionIds: async () => ['exec-1'],
      findWaitingNodeRun: async () => ({
        nodeId: 'gc1',
        nodeType: 'groupChat',
        metadata,
      }),
      failUserProxyTimeout,
      now: () => Date.parse('2026-06-20T13:00:00.000Z'),
    });

    expect(resolved).toBe(0);
    expect(failUserProxyTimeout).not.toHaveBeenCalled();
  });

  it('fails execution when still waiting after timeout expires', async () => {
    const expiresAt = '2026-06-20T12:00:00.000Z';
    const metadata = {
      hitl: {
        prompt: '请输入',
        allowReject: false,
        allowSupplement: true,
        userProxyTimeoutMs: 1000,
        userProxyTimeoutAction: 'fail',
        requestedAt: '2026-06-20T11:59:59.000Z',
        expiresAt,
      },
      groupChat: { checkpoint: sampleCheckpoint },
    };

    expect(shouldSweepGroupChatUserProxyWaiting(metadata)).toBe(true);
    expect(
      isGroupChatUserProxyWaitingExpired(
        metadata,
        Date.parse('2026-06-20T12:00:01.000Z'),
      ),
    ).toBe(true);

    const failUserProxyTimeout = vi.fn().mockResolvedValue({ status: 'failed' });
    const resolved = await runGroupChatUserProxyTimeoutSweepOnce({
      listWaitingExecutionIds: async () => ['exec-1'],
      findWaitingNodeRun: async () => ({
        nodeId: 'gc1',
        nodeType: 'groupChat',
        metadata,
      }),
      failUserProxyTimeout,
      now: () => Date.parse('2026-06-20T12:00:01.000Z'),
    });

    expect(resolved).toBe(1);
    expect(failUserProxyTimeout).toHaveBeenCalledWith({
      executionId: 'exec-1',
      nodeId: 'gc1',
      failure: buildGroupChatUserProxyTimeoutFailure(),
    });
    expect(buildGroupChatUserProxyTimeoutFailure()).toMatchObject({
      status: 'failed',
      errorCode: 'E1048',
    });
  });
});
