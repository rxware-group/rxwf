/**
 * M3 AC-41: publish bot → API Key chat → public stream → MCP chat_bot_run
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('chat bots three-channel AC-41', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;
  let botSlug: string;
  let botApiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();

    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      aiRuntime: {
        async *chat() {
          yield 'mock-bot-reply';
        },
        async runAgent() {
          return { items: [] };
        },
      },
    });
    app = built.app;

    const users = createUserService(db);
    const auth = createAuthService(db);
    const owner = await users.createUser({
      email: 'ac41@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(owner.id, 'ac41')).key;

    const createBot = await app.inject({
      method: 'POST',
      url: '/api/chat-bots',
      headers: { 'x-api-key': apiKey },
      payload: {
        name: 'AC41 Bot',
        slug: 'ac41-bot',
        config: { mode: 'chat', knowledgeBaseIds: [], fallbackToChat: true },
      },
    });
    expect(createBot.statusCode).toBe(201);
    const bot = createBot.json() as { id: string; slug: string };
    botSlug = bot.slug;

    for (const channel of ['api', 'embed', 'mcp'] as const) {
      const ch = await app.inject({
        method: 'PATCH',
        url: `/api/chat-bots/${bot.id}/channels/${channel}`,
        headers: { 'x-api-key': apiKey },
        payload: { enabled: true },
      });
      expect(ch.statusCode).toBe(200);
    }

    const published = await app.inject({
      method: 'POST',
      url: `/api/chat-bots/${bot.id}/publish`,
      headers: { 'x-api-key': apiKey },
    });
    expect(published.statusCode).toBe(200);

    const keyRes = await app.inject({
      method: 'POST',
      url: `/api/chat-bots/${bot.id}/api-keys`,
      headers: { 'x-api-key': apiKey },
      payload: { name: 'AC41' },
    });
    expect(keyRes.statusCode).toBe(201);
    botApiKey = (keyRes.json() as { key: string }).key;

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('API Key channel returns aggregated answer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/public/chat/bots/${botSlug}/chat`,
      headers: { authorization: `Bearer ${botApiKey}` },
      payload: { message: 'hello api' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: string; sessionId: string; clientToken: string };
    expect(body.answer).toContain('mock-bot-reply');
    expect(body.sessionId).toBeTruthy();
    expect(body.clientToken).toBeTruthy();
  });

  it('public embed session streams without auth', async () => {
    const sessionRes = await app.inject({
      method: 'POST',
      url: `/api/public/chat/${botSlug}/session`,
    });
    expect(sessionRes.statusCode).toBe(200);
    const { sessionId, clientToken } = sessionRes.json() as {
      sessionId: string;
      clientToken: string;
    };

    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/public/chat/sessions/${sessionId}/stream`,
      headers: { 'x-chat-client-token': clientToken },
      payload: { content: 'hello embed' },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('mock-bot-reply');
    expect(streamRes.body).toContain('[DONE]');
  });

  it('MCP chat_bot_run returns aggregated JSON', async () => {
    const toolsRes = await app.inject({
      method: 'GET',
      url: '/mcp/tools',
      headers: headers(),
    });
    expect(toolsRes.statusCode).toBe(200);
    const tools = (toolsRes.json() as { tools: Array<{ name: string }> }).tools;
    expect(tools.some((t) => t.name === 'chat_bot_run')).toBe(true);

    const callRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: headers(),
      payload: {
        name: 'chat_bot_run',
        arguments: { botSlug, message: 'hello mcp' },
      },
    });
    expect(callRes.statusCode).toBe(200);
    const text = (callRes.json() as { content: Array<{ text: string }> }).content[0]?.text ?? '';
    const parsed = JSON.parse(text) as { answer: string; sessionId: string };
    expect(parsed.answer).toContain('mock-bot-reply');
    expect(parsed.sessionId).toBeTruthy();
  });
});
