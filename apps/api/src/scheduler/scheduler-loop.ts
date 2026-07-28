export interface SchedulerLoopOptions {
  tick: () => Promise<void>;
  intervalMs: number;
}

export function startSchedulerLoop(options: SchedulerLoopOptions): { stop: () => void } {
  void options.tick().catch((err) => {
    console.error('[scheduler] tick failed', err);
  });

  const timer = setInterval(() => {
    void options.tick().catch((err) => {
      console.error('[scheduler] tick failed', err);
    });
  }, options.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
