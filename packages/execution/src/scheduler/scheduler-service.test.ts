import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSchedulerService } from './scheduler-service.js';

describe('createSchedulerService', () => {
  const tryAcquireLease = vi.fn();
  const releaseLease = vi.fn();
  const listDueSchedules = vi.fn();
  const enqueueSchedule = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    tryAcquireLease.mockResolvedValue(true);
    releaseLease.mockResolvedValue(undefined);
    listDueSchedules.mockResolvedValue([]);
    enqueueSchedule.mockResolvedValue(undefined);
  });

  it('skips tick when lease is not acquired', async () => {
    tryAcquireLease.mockResolvedValue(false);
    const scheduler = createSchedulerService({
      holderId: 'api-1',
      tryAcquireLease,
      releaseLease,
      listDueSchedules,
      enqueueSchedule,
    });
    const result = await scheduler.tick(new Date('2026-05-20T10:00:00Z'));
    expect(result.enqueued).toBe(0);
    expect(listDueSchedules).not.toHaveBeenCalled();
    expect(enqueueSchedule).not.toHaveBeenCalled();
  });

  it('enqueues each due schedule trigger via ingress port', async () => {
    listDueSchedules.mockResolvedValue([
      { workflowId: 'wf-1', cron: '0 * * * *', timezone: 'UTC' },
      { workflowId: 'wf-2', cron: '*/5 * * * *', timezone: 'Asia/Shanghai' },
    ]);
    const scheduler = createSchedulerService({
      holderId: 'api-1',
      tryAcquireLease,
      releaseLease,
      listDueSchedules,
      enqueueSchedule,
    });
    const now = new Date('2026-05-20T10:00:00Z');
    const result = await scheduler.tick(now);
    expect(result.enqueued).toBe(2);
    expect(listDueSchedules).toHaveBeenCalledWith(now);
    expect(enqueueSchedule).toHaveBeenCalledTimes(2);
    expect(enqueueSchedule).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      cron: '0 * * * *',
      timezone: 'UTC',
      triggerType: 'schedule',
    });
    expect(releaseLease).toHaveBeenCalled();
  });
});
