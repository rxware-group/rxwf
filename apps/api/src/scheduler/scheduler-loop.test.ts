import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startSchedulerLoop } from './scheduler-loop.js';

describe('startSchedulerLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes tick on interval and stops cleanly', async () => {
    const tick = vi.fn(async () => undefined);
    const handle = startSchedulerLoop({ tick, intervalMs: 60_000 });
    await Promise.resolve();
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
    handle.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
