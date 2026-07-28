import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createStandardHealthChecker } from '../health.js';
import { openStandardDatabase } from '../drizzle/client.js';
import { createStandardChatRepository } from './chat-repository.js';
import { createStandardChatBotsRepository } from './chat-bots-repository.js';
import { users } from '../drizzle/schema.js';

const PG_URL =
  process.env.RXWF_DATABASE_URL ?? 'postgres://rxwf:rxwf@localhost:5432/rxwf';

describe('standard chat repositories', () => {
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

  it('creates chat session and bot publish log', async () => {
    if (skip) return;
    const { db } = await openStandardDatabase(PG_URL);
    const userId = `u-${crypto.randomUUID()}`;
    await db.insert(users).values({
      id: userId,
      email: `${userId}@example.com`,
      passwordHash: 'hash',
      createdAt: new Date(),
    });

    const chatRepo = createStandardChatRepository(db);
    const sessionId = crypto.randomUUID();
    await chatRepo.createSession({
      id: sessionId,
      userId,
      title: 'PG smoke',
      mode: 'chat',
    });
    const listed = await chatRepo.listSessions(userId);
    expect(listed.some((s) => s.id === sessionId)).toBe(true);

    const botsRepo = createStandardChatBotsRepository(db);
    const botId = crypto.randomUUID();
    await botsRepo.createBot({
      id: botId,
      ownerUserId: userId,
      name: 'Std Bot',
      slug: `std-${botId.slice(0, 8)}`,
    });
    await botsRepo.appendPublishLog({
      id: crypto.randomUUID(),
      botId,
      versionId: null,
      action: 'created',
      detail: {},
      userId,
    });
    const log = await botsRepo.listPublishLog(botId);
    expect(log.length).toBeGreaterThan(0);
  });
});
