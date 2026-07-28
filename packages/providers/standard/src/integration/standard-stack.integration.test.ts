import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createStandardHealthChecker } from '../health.js';
import { openStandardDatabase } from '../drizzle/client.js';
import { createBullMQQueueProvider } from '../queue/bullmq-queue-provider.js';

const DATABASE_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';
const REDIS_URL = process.env.RXWF_REDIS_URL ?? 'redis://localhost:6379';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('standard stack (postgres + redis)', () => {
  let skip = false;

  beforeAll(async () => {
    try {
      const checker = createStandardHealthChecker({
        databaseUrl: DATABASE_URL,
        redisUrl: REDIS_URL,
      });
      const health = await checker.check();
      if (!health.ready) skip = true;
    } catch {
      skip = true;
    }
  });

  it('health checker reports ready when services are up', async () => {
    if (skip) return;
    const checker = createStandardHealthChecker({
      databaseUrl: DATABASE_URL,
      redisUrl: REDIS_URL,
    });
    const result = await checker.check();
    expect(result.postgres).toBe(true);
    expect(result.redis).toBe(true);
    expect(result.ready).toBe(true);
  });

  it('bullmq enqueues and processes an execution job', async () => {
    if (skip) return;
    const bull = createBullMQQueueProvider({ redisUrl: REDIS_URL });
    let processed = false;
    const stop = await bull.startWorker(async () => {
      processed = true;
      return { executionId: 'probe-exec', status: 'success' };
    });

    await bull.enqueueExecutionJob({
      workflowId: 'wf-probe',
      triggerType: 'manual',
      mode: 'manual',
    });

    for (let i = 0; i < 40 && !processed; i++) {
      await sleep(50);
    }

    expect(processed).toBe(true);
    await stop();
  });

  it('runProbe completes within timeout', async () => {
    if (skip) return;
    const bull = createBullMQQueueProvider({ redisUrl: REDIS_URL });
    const runProbe = bull.provider.runProbe;
    if (!runProbe) return;
    const ok = await runProbe(async () => undefined, 8000);
    expect(ok).toBe(true);
  });

  afterAll(async () => {
    const { pool } = await openStandardDatabase(DATABASE_URL).catch(() => ({
      pool: undefined,
    }));
    if (pool) await pool.end();
  });
});
