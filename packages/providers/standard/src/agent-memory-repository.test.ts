import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createStandardHealthChecker } from './health.js';
import { createStandardAgentMemoryRepository } from './agent-memory-repository.js';
import { openStandardDatabase } from './drizzle/client.js';

const PG_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';

describe('createStandardAgentMemoryRepository', () => {
  let skip = false;
  let pool: Awaited<ReturnType<typeof openStandardDatabase>>['pool'];

  beforeAll(async () => {
    const health = await createStandardHealthChecker({
      databaseUrl: PG_URL,
      redisUrl: process.env.RXWF_REDIS_URL ?? 'redis://localhost:6379',
    }).check();
    if (!health.postgres) {
      skip = true;
      return;
    }
    ({ pool } = await openStandardDatabase(PG_URL));
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('listRecent returns messages in order (AC-B5 standard)', async () => {
    if (skip) return;
    const { db } = await openStandardDatabase(PG_URL);
    const repo = createStandardAgentMemoryRepository(db);
    const sessionId = `std-${crypto.randomUUID()}`;
    await repo.append({ sessionId, role: 'user', content: 'ping', executionId: 'e1' });
    await repo.append({
      sessionId,
      role: 'assistant',
      content: 'pong',
      executionId: 'e1',
    });
    const rows = await repo.listRecent(sessionId, 5);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.role).toBe('user');
    expect(rows[0]?.content).toBe('ping');
    expect(rows[1]?.role).toBe('assistant');
    expect(rows[1]?.content).toBe('pong');
  });
});
