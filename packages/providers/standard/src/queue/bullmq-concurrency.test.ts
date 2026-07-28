import { describe, it, expect, vi, beforeEach } from 'vitest';

const workerOptions: Array<Record<string, unknown>> = [];

vi.mock('bullmq', () => {
  class Queue {
    async add() {
      return { id: 'job-1' };
    }
    async close() {}
  }
  class Worker {
    constructor(
      _name: string,
      _processor: (...args: unknown[]) => Promise<void>,
      options: Record<string, unknown>,
    ) {
      workerOptions.push(options);
    }
    async close() {}
  }
  return { Queue, Worker };
});

vi.mock('ioredis', () => {
  return {
    Redis: class Redis {
      constructor(_url: string, _options: Record<string, unknown>) {}
      async quit() {}
    },
  };
});

import { createBullMQQueueProvider } from './bullmq-queue-provider.js';
import { createBullMQKnowledgeQueue } from './bullmq-knowledge-queue.js';

describe('bullmq queue concurrency', () => {
  beforeEach(() => {
    workerOptions.length = 0;
  });

  it('passes execution concurrency to Worker', async () => {
    const queue = createBullMQQueueProvider({
      redisUrl: 'redis://localhost:6379',
      concurrency: 6,
    });
    const stop = await queue.startWorker(async () => ({
      executionId: 'ex-1',
      status: 'success',
    }));
    await stop();

    expect(workerOptions.length).toBeGreaterThan(0);
    expect(workerOptions[0]?.concurrency).toBe(6);
  });

  it('passes knowledge concurrency to Worker', async () => {
    const queue = createBullMQKnowledgeQueue({
      redisUrl: 'redis://localhost:6379',
      concurrency: 3,
    });
    const stop = await queue.startWorker({
      indexDocument: async () => undefined,
      syncFromSource: async () => undefined,
    });
    await stop();

    expect(workerOptions.length).toBeGreaterThan(0);
    expect(workerOptions[0]?.concurrency).toBe(3);
  });

  it('normalizes invalid execution concurrency to safe fallback', async () => {
    const queue = createBullMQQueueProvider({
      redisUrl: 'redis://localhost:6379',
      concurrency: 0,
    });
    const stop = await queue.startWorker(async () => ({
      executionId: 'ex-2',
      status: 'success',
    }));
    await stop();

    expect(workerOptions.length).toBeGreaterThan(0);
    expect(workerOptions[0]?.concurrency).toBe(1);
  });

  it('falls back to default knowledge concurrency for NaN input', async () => {
    const queue = createBullMQKnowledgeQueue({
      redisUrl: 'redis://localhost:6379',
      concurrency: Number.NaN,
    });
    const stop = await queue.startWorker({
      indexDocument: async () => undefined,
      syncFromSource: async () => undefined,
    });
    await stop();

    expect(workerOptions.length).toBeGreaterThan(0);
    expect(workerOptions[0]?.concurrency).toBe(2);
  });
});
