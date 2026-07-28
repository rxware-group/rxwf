/**
 * Regenerate truncates assistant + later messages and re-streams.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

describe('chat regenerate', () => {
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
          yield 'reply-';
          yield 'ok';
        },
        async runAgent() {
          return { items: [] };
        },
      },
    });
    app = built.app;

    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'chat-regen@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'regen')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('replaces assistant message via SSE regenerate', async () => {
    const headers = { 'x-api-key': apiKey };
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers,
      payload: { title: 'Regen test' },
    });
    const session = createRes.json() as { id: string };

    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers,
      payload: { content: 'hello' },
    });
    expect(streamRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/chat/sessions/${session.id}/messages`,
      headers,
    });
    const assistant = (listRes.json() as { messages: Array<{ id: string; role: string }> }).messages.find(
      (m) => m.role === 'assistant',
    );
    expect(assistant).toBeDefined();

    const regenRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/messages/${assistant!.id}/regenerate`,
      headers,
      payload: {},
    });
    expect(regenRes.statusCode).toBe(200);
    expect(regenRes.body).toContain('"token":"reply-"');
    expect(regenRes.body).toContain('[DONE]');

    const afterRes = await app.inject({
      method: 'GET',
      url: `/api/chat/sessions/${session.id}/messages`,
      headers,
    });
    const messages = (afterRes.json() as { messages: Array<{ role: string; content: string }> }).messages;
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(1);
    expect(messages.find((m) => m.role === 'assistant')?.content).toBe('reply-ok');
  });
});
