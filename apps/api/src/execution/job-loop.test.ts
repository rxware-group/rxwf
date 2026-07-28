import { describe, it, expect, vi } from 'vitest';
import { startJobLoop } from './job-loop.js';

describe('startJobLoop', () => {
  it('skips overlapping ticks when previous run is still running', async () => {
    vi.useFakeTimers();
    let activeRuns = 0;
    let maxActiveRuns = 0;
    let callCount = 0;
    const processOnce = vi.fn(async () => {
      callCount += 1;
      activeRuns += 1;
      maxActiveRuns = Math.max(maxActiveRuns, activeRuns);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeRuns -= 1;
      return 1;
    });

    const loop = startJobLoop({ processOnce, intervalMs: 10 });
    await vi.advanceTimersByTimeAsync(140);
    loop.stop();

    expect(maxActiveRuns).toBe(1);
    expect(callCount).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('reports overlap skip events', async () => {
    vi.useFakeTimers();
    const onSkipOverlap = vi.fn();
    const processOnce = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 1;
    });

    const loop = startJobLoop({ processOnce, intervalMs: 10, onSkipOverlap });
    await vi.advanceTimersByTimeAsync(140);
    loop.stop();

    expect(onSkipOverlap).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
