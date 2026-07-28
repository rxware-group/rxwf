/**
 * M1 Chat 集成测试：AC-18+ 多 token 流式 + 历史持久化
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('M1 chat integration (AC-18+)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      aiRuntime: {
        async *chat() {
          yield 'tok1';
          yield 'tok2';
        },
      },
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'chat-m1@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'chat-m1')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('streams multiple tokens and persists history (AC-18+)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: { title: 'M1 Chat' },
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json() as { id: string };

    const userContent = 'hello m1';
    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers: headers(),
      payload: { content: userContent },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('"token":"tok1"');
    expect(streamRes.body).toContain('"token":"tok2"');
    expect(streamRes.body).toContain('[DONE]');

    const messagesRes = await app.inject({
      method: 'GET',
      url: `/api/chat/sessions/${session.id}/messages`,
      headers: headers(),
    });
    expect(messagesRes.statusCode).toBe(200);
    const messages = (messagesRes.json() as {
      messages: Array<{ role: string; content: string }>;
    }).messages;
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = messages.find((m) => m.role === 'user');
    const assistantMsg = messages.find((m) => m.role === 'assistant');
    expect(userMsg?.content).toBe(userContent);
    expect(assistantMsg?.content).toBe('tok1tok2');
  });

  // Abort mid-stream is covered by packages/chat/src/chat-abort.test.ts.
  // Fastify inject() does not simulate client disconnect / request.raw 'close',
  // so we cannot reliably trigger AbortController via the HTTP layer here.
});
