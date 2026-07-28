import { describe, expect, it } from 'vitest';
import { createLiteAgentMemoryRepository, createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';
import { createAuthService, createUserService } from '@rxwf/identity';

async function createApiKey(
  db: Awaited<ReturnType<typeof createTestDb>>,
  role: 'admin' | 'member',
) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `mem-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role,
  });
  const { key } = await auth.createApiKey(user.id, 'test');
  return key;
}

describe('agent-memory routes', () => {
  it('GET /api/agent-memory/sessions requires admin', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const memberKey = await createApiKey(db, 'member');

    const res = await app.inject({
      method: 'GET',
      url: '/api/agent-memory/sessions',
      headers: { 'x-api-key': memberKey },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('admin can list, read, and delete agent memory', async () => {
    const db = await createTestDb();
    const repo = createLiteAgentMemoryRepository(db);
    await repo.append({ sessionId: 'sess-a', role: 'user', content: 'hello' });
    const assistant = await repo.append({
      sessionId: 'sess-a',
      role: 'assistant',
      content: 'world',
    });

    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const adminKey = await createApiKey(db, 'admin');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/agent-memory/sessions',
      headers: { 'x-api-key': adminKey },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as {
      items: Array<{
        sessionId: string;
        messageCount: number;
        firstMessageAt: string;
        lastMessageAt: string;
      }>;
      total: number;
    };
    expect(listBody.total).toBeGreaterThanOrEqual(1);
    const sessA = listBody.items.find((item) => item.sessionId === 'sess-a');
    expect(sessA).toBeDefined();
    expect(new Date(sessA!.firstMessageAt).getFullYear()).toBeGreaterThan(2020);
    expect(new Date(sessA!.lastMessageAt).getFullYear()).toBeGreaterThan(2020);

    const msgRes = await app.inject({
      method: 'GET',
      url: '/api/agent-memory/sessions/sess-a/messages?limit=100',
      headers: { 'x-api-key': adminKey },
    });
    expect(msgRes.statusCode).toBe(200);
    const msgBody = msgRes.json() as { messages: Array<{ id: string }> };
    expect(msgBody.messages).toHaveLength(2);

    const delMsgRes = await app.inject({
      method: 'DELETE',
      url: `/api/agent-memory/sessions/sess-a/messages/${assistant.id}`,
      headers: { 'x-api-key': adminKey },
    });
    expect(delMsgRes.statusCode).toBe(204);

    const delSessionRes = await app.inject({
      method: 'DELETE',
      url: '/api/agent-memory/sessions/sess-a',
      headers: { 'x-api-key': adminKey },
    });
    expect(delSessionRes.statusCode).toBe(200);
    expect((delSessionRes.json() as { deleted: number }).deleted).toBe(1);

    await app.close();
  });
});
