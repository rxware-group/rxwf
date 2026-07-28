export interface JobLoopOptions {
  processOnce: () => Promise<number>;
  intervalMs: number;
  onSkipOverlap?: () => void;
}

export function startJobLoop(options: JobLoopOptions): { stop: () => void } {
  let running = false;
  const runOnce = async () => {
    if (running) {
      options.onSkipOverlap?.();
      return;
    }
    running = true;
    try {
      await options.processOnce();
    } catch (err) {
      console.error('[jobs] process failed', err);
    } finally {
      running = false;
    }
  };

  void runOnce();

  const timer = setInterval(() => {
    void runOnce();
  }, options.intervalMs);

  return { stop: () => clearInterval(timer) };
}
