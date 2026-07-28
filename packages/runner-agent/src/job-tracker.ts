export class JobTracker {
  private readonly jobs = new Map<string, AbortController>();

  track(jobId: string, controller: AbortController = new AbortController()): AbortController {
    this.jobs.set(jobId, controller);
    return controller;
  }

  cancel(jobId: string): boolean {
    const controller = this.jobs.get(jobId);
    if (!controller) {
      return false;
    }
    controller.abort();
    return true;
  }

  untrack(jobId: string): void {
    this.jobs.delete(jobId);
  }

  get(jobId: string): AbortController | undefined {
    return this.jobs.get(jobId);
  }

  get size(): number {
    return this.jobs.size;
  }
}
