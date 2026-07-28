import { describe, expect, it } from 'vitest';
import { createTestDb } from './test-db.js';
import { createLiteAgentMemoryRepository } from './agent-memory-repository.js';

describe('createLiteAgentMemoryRepository', () => {
  it('listRecent returns messages in chronological order', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 's1', role: 'user', content: 'hi', executionId: 'e1' });
    await new Promise((r) => setTimeout(r, 2));
    await repo.append({
      sessionId: 's1',
      role: 'assistant',
      content: 'hello',
      executionId: 'e1',
    });
    const rows = await repo.listRecent('s1', 10);
    expect(rows).toHaveLength(2);
    const roles = new Set(rows.map((r) => r.role));
    expect(roles).toEqual(new Set(['user', 'assistant']));
  });

  it('listSessions aggregates by session id', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 'alpha-session', role: 'user', content: 'a' });
    await repo.append({ sessionId: 'alpha-session', role: 'assistant', content: 'b' });
    await repo.append({ sessionId: 'beta-session', role: 'user', content: 'c' });

    const all = await repo.listSessions({ limit: 10 });
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(2);
    const alpha = all.items.find((item) => item.sessionId === 'alpha-session');
    expect(alpha?.messageCount).toBe(2);
    expect(alpha?.firstMessageAt.getFullYear()).toBeGreaterThan(2020);
    expect(alpha?.lastMessageAt.getFullYear()).toBeGreaterThan(2020);
  });

  it('listSessions supports search filter', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 'prefix-one', role: 'user', content: 'x' });
    await repo.append({ sessionId: 'other', role: 'user', content: 'y' });

    const filtered = await repo.listSessions({ search: 'prefix' });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.sessionId).toBe('prefix-one');
  });

  it('listAllMessages returns chronological rows with pagination', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 'paged', role: 'user', content: '1' });
    await repo.append({ sessionId: 'paged', role: 'assistant', content: '2' });
    await repo.append({ sessionId: 'paged', role: 'user', content: '3' });

    const page = await repo.listAllMessages('paged', { limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
    expect(page[0]?.content).toBe('2');
    expect(page[1]?.content).toBe('3');
  });

  it('deleteSession removes all rows for session', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 'del-me', role: 'user', content: 'x' });
    await repo.append({ sessionId: 'del-me', role: 'assistant', content: 'y' });

    const removed = await repo.deleteSession('del-me');
    expect(removed).toBe(2);
    expect(await repo.listRecent('del-me', 10)).toHaveLength(0);
  });

  it('deleteMessage removes a single row', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    const first = await repo.append({ sessionId: 'one', role: 'user', content: 'keep' });
    await repo.append({ sessionId: 'one', role: 'assistant', content: 'stay' });

    expect(await repo.deleteMessage(first.id)).toBe(true);
    const rows = await repo.listRecent('one', 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe('stay');
    expect(await repo.deleteMessage('missing-id')).toBe(false);
  });
});
