import { describe, expect, it, vi } from 'vitest';
import { runHitlTimeoutSweepOnce } from './hitl-sweeper.js';

describe('runHitlTimeoutSweepOnce', () => {
  it('resumes expired waiting executions with configured timeout action', async () => {
    const resumeHitl = vi.fn().mockResolvedValue({ status: 'failed' });
    const expiresAt = '2026-05-29T12:00:00.000Z';

    const resolved = await runHitlTimeoutSweepOnce({
      listWaitingExecutionIds: async () => ['exec-1'],
      findWaitingNodeRun: async () => ({
        nodeId: 'ap',
        metadata: {
          hitl: {
            expiresAt,
            timeoutAction: 'reject',
            requestedAt: '2026-05-29T11:59:50.000Z',
          },
        },
      }),
      resumeHitl,
      now: () => Date.parse('2026-05-29T12:00:01.000Z'),
    });

    expect(resolved).toBe(1);
    expect(resumeHitl).toHaveBeenCalledWith({
      executionId: 'exec-1',
      nodeId: 'ap',
      decision: 'reject',
      comment: 'Auto-resolved on timeout',
    });
  });

  it('skips non-expired waiting executions', async () => {
    const resumeHitl = vi.fn();

    const resolved = await runHitlTimeoutSweepOnce({
      listWaitingExecutionIds: async () => ['exec-1'],
      findWaitingNodeRun: async () => ({
        nodeId: 'ap',
        metadata: {
          hitl: {
            expiresAt: '2026-05-29T12:00:10.000Z',
            timeoutAction: 'reject',
          },
        },
      }),
      resumeHitl,
      now: () => Date.parse('2026-05-29T12:00:01.000Z'),
    });

    expect(resolved).toBe(0);
    expect(resumeHitl).not.toHaveBeenCalled();
  });
});
