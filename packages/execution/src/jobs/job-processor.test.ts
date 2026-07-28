import { describe, it, expect, vi } from 'vitest';
import { createJobProcessor, executionEnqueueHandler } from './job-processor.js';

describe('createJobProcessor', () => {
  it('processes execution.enqueue jobs and marks them completed', async () => {
    const handleEnqueue = vi.fn(async () => ({
      executionId: 'ex-1',
      status: 'success',
    }));
    const markCompleted = vi.fn();
    const markFailed = vi.fn();
    const processor = createJobProcessor({
      claimPending: vi.fn(async () => [
        {
          id: 'job-1',
          kind: 'execution.enqueue',
          payload: JSON.stringify({
            workflowId: 'wf-1',
            triggerType: 'schedule',
          }),
        },
      ]),
      markCompleted,
      markFailed,
      handlers: [executionEnqueueHandler(handleEnqueue)],
    });

    const processed = await processor.processOnce();
    expect(processed).toBe(1);
    expect(handleEnqueue).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      triggerType: 'schedule',
    });
    expect(markCompleted).toHaveBeenCalledWith('job-1');
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('respects configured concurrency limit and keeps per-job failure semantics', async () => {
    let active = 0;
    let maxActive = 0;
    const markCompleted = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);
    const processor = createJobProcessor({
      claimPending: vi.fn(async () => [
        { id: 'job-1', kind: 'slow', payload: 'a' },
        { id: 'job-2', kind: 'slow', payload: 'b' },
        { id: 'job-3', kind: 'slow', payload: 'c' },
        { id: 'job-4', kind: 'slow', payload: 'd' },
      ]),
      markCompleted,
      markFailed,
      concurrency: 2,
      handlers: [
        {
          kind: 'slow',
          handle: async (payload: string) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => setTimeout(resolve, 10));
            active -= 1;
            if (payload === 'c') {
              throw new Error('boom');
            }
          },
        },
      ],
    });

    const processed = await processor.processOnce(10);
    expect(processed).toBe(4);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(markCompleted).toHaveBeenCalledTimes(3);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledWith('job-3', 'boom');
  });

  it('reports processing summary after each batch', async () => {
    const onProcessed = vi.fn();
    const processor = createJobProcessor({
      claimPending: vi.fn(async () => [
        { id: 'job-1', kind: 'ok', payload: 'a' },
        { id: 'job-2', kind: 'bad', payload: 'b' },
      ]),
      markCompleted: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
      concurrency: 3,
      onProcessed,
      handlers: [
        { kind: 'ok', handle: async () => undefined },
        { kind: 'bad', handle: async () => { throw new Error('x'); } },
      ],
    });

    await processor.processOnce(10);
    expect(onProcessed).toHaveBeenCalledTimes(1);
    expect(onProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        claimed: 2,
        completed: 1,
        failed: 1,
        concurrency: 3,
      }),
    );
  });
});
