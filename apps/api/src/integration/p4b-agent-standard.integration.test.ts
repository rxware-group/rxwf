/**
 * P4-B Standard profile agent smoke (AC-B5).
 * Requires Postgres: RXWF_DATABASE_URL=postgres://...
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  createStandardHealthChecker,
  createStandardAgentMemoryRepository,
  openStandardDatabase,
} from '@rxwf/providers-standard';

const PG_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';

describe('P4-B agent standard profile (AC-B5)', () => {
  let skip = false;

  beforeAll(async () => {
    const health = await createStandardHealthChecker({
      databaseUrl: PG_URL,
      redisUrl: process.env.RXWF_REDIS_URL ?? 'redis://localhost:6379',
    }).check();
    if (!health.postgres) skip = true;
  });

  it('persists session memory in Postgres agent_session_messages', async () => {
    if (skip) return;
    const { db, pool } = await openStandardDatabase(PG_URL);
    try {
      const repo = createStandardAgentMemoryRepository(db);
      const sessionId = `p4b-std-${crypto.randomUUID()}`;
      await repo.append({
        sessionId,
        role: 'user',
        content: 'hello standard',
        executionId: 'exec-1',
      });
      const rows = await repo.listRecent(sessionId, 10);
      expect(rows.some((r) => r.content === 'hello standard')).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
