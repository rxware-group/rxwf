export class JobPool {
  private slotsInUse = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be a positive integer');
    }
  }

  /** Acquire a slot; waits when at capacity until {@link release} frees one. */
  async accept(): Promise<void> {
    if (this.slotsInUse < this.maxConcurrent) {
      this.slotsInUse += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        resolve();
      });
    });
  }

  /** Try to acquire a slot without waiting. */
  tryAccept(): boolean {
    if (this.slotsInUse >= this.maxConcurrent) {
      return false;
    }
    this.slotsInUse += 1;
    return true;
  }

  /** Release a slot and admit the next waiter, if any. */
  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
      return;
    }

    if (this.slotsInUse > 0) {
      this.slotsInUse -= 1;
    }
  }

  get inUse(): number {
    return this.slotsInUse;
  }

  get waiting(): number {
    return this.waitQueue.length;
  }
}
