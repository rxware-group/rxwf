import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { createChatService } from '@rxwf/chat';
import { createChatBotService, configToResolved } from '@rxwf/chat-bots';
import {
  createLiteChatBotsRepository,
  createLiteChatRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { registerPublicChatRoutes } from './public-chat.js';

describe('public chat routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    const db = await createTestDb();
    await db.insert(liteSchema.users).values({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      createdAt: new Date(),
    });
    const chatRepo = createLiteChatRepository(db);
    const chatBotsRepo = createLiteChatBotsRepository(db);
    const chatBotService = createChatBotService({ repo: chatBotsRepo });
    const chatService = createChatService({
      repo: chatRepo,
      ai: {
        async *chat() {
          yield 'hello';
        },
        async runAgent() {
          return { items: [] };
        },
      },
      bots: {
        getDraftConfig: async (botId, userId) =>
          configToResolved(await chatBotService.getDraftConfig(botId, userId)),
        resolvePublishedConfig: (v) => chatBotService.resolvePublishedConfig(v),
        resolveForSession: (input) => chatBotService.resolveForSession(input),
      },
    });

    app = Fastify();
    registerPublicChatRoutes(app, chatService, chatBotService, chatRepo);
    const bot = await chatBotService.createBot('user-1', {
      name: 'Public Test',
      slug: 'public-test',
    });
    await chatBotService.setChannel(bot.id, 'user-1', 'embed', true);
    await chatBotService.publish(bot.id, 'user-1');
    await app.ready();
  });

  it('creates public session without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/public/chat/public-test/session',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessionId: string; clientToken: string };
    expect(body.sessionId).toBeTruthy();
    expect(body.clientToken).toBeTruthy();
  });
});
