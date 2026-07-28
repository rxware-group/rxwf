import type { FastifyInstance } from 'fastify';
import {
  generateBotConfigFromPrompt,
  type ChatBotConfig,
  type ChatBotService,
} from '@rxwf/chat-bots';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { createChatService } from '@rxwf/chat';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

type ChatService = ReturnType<typeof createChatService>;

function parseConfig(body: Record<string, unknown>): Partial<ChatBotConfig> {
  const patch: Partial<ChatBotConfig> = {};
  if (typeof body.systemPrompt === 'string') patch.systemPrompt = body.systemPrompt;
  if (typeof body.openingMessage === 'string') patch.openingMessage = body.openingMessage;
  if (typeof body.themeColor === 'string') patch.themeColor = body.themeColor;
  if (typeof body.modelId === 'string') patch.modelId = body.modelId;
  if (body.mode === 'chat' || body.mode === 'rag') patch.mode = body.mode;
  if (Array.isArray(body.knowledgeBaseIds)) {
    patch.knowledgeBaseIds = body.knowledgeBaseIds.filter((id): id is string => typeof id === 'string');
  }
  if (body.ragTemplate === 'support' || body.ragTemplate === 'code') {
    patch.ragTemplate = body.ragTemplate;
  }
  if (typeof body.fallbackToChat === 'boolean') patch.fallbackToChat = body.fallbackToChat;
  if (body.accessPolicy === 'public' || body.accessPolicy === 'authenticated' || body.accessPolicy === 'role') {
    patch.accessPolicy = body.accessPolicy;
  }
  return patch;
}

export function registerChatBotRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
  chatBots: ChatBotService,
  chatService?: ChatService,
  ai?: AiRuntime,
): void {
  app.get('/api/chat-bots', { preHandler: authPreHandler }, async (request) => ({
    items: await chatBots.listBots(request.auth!.userId),
  }));

  app.post('/api/chat-bots', { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body ?? {}) as { name?: string; slug?: string; config?: Partial<ChatBotConfig> };
    if (!body.name?.trim()) {
      return reply.status(400).send({ code: 'E1004', message: 'name required' });
    }
    const bot = await chatBots.createBot(request.auth!.userId, {
      name: body.name,
      slug: body.slug,
      config: body.config,
    });
    return reply.status(201).send(bot);
  });

  app.get('/api/chat-bots/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const bot = await chatBots.getBot(id, request.auth!.userId);
      const draft = await chatBots.getDraftConfig(id, request.auth!.userId);
      return { bot, draft };
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.patch('/api/chat-bots/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      if (body.config && typeof body.config === 'object') {
        await chatBots.updateDraftConfig(id, request.auth!.userId, parseConfig(body.config as Record<string, unknown>));
      }
      const bot = await chatBots.updateBot(id, request.auth!.userId, {
        name: typeof body.name === 'string' ? body.name : undefined,
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      });
      const draft = await chatBots.getDraftConfig(id, request.auth!.userId);
      return { bot, draft };
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: string }).code) : 'E1001';
      return reply.status(code === 'E1004' ? 400 : 404).send({
        code,
        message: err instanceof Error ? err.message : 'Chat bot not found',
      });
    }
  });

  app.delete('/api/chat-bots/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await chatBots.deleteBot(id, request.auth!.userId);
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.post('/api/chat-bots/:id/publish', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const bot = await chatBots.publish(id, request.auth!.userId);
      return bot;
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: string }).code) : 'E1001';
      return reply.status(404).send({ code, message: err instanceof Error ? err.message : 'Not found' });
    }
  });

  app.post('/api/chat-bots/:id/unpublish', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const bot = await chatBots.unpublish(id, request.auth!.userId);
      return bot;
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.get('/api/chat-bots/:id/channels', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return { items: await chatBots.listChannels(id, request.auth!.userId) };
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.patch(
    '/api/chat-bots/:id/channels/:channel',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id, channel } = request.params as { id: string; channel: string };
      if (channel !== 'api' && channel !== 'embed' && channel !== 'mcp') {
        return reply.status(400).send({ code: 'E1004', message: 'Invalid channel' });
      }
      const body = (request.body ?? {}) as { enabled?: boolean; config?: Record<string, unknown> };
      try {
        const row = await chatBots.setChannel(
          id,
          request.auth!.userId,
          channel,
          Boolean(body.enabled),
          body.config,
        );
        return row;
      } catch {
        return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
      }
    },
  );

  app.get('/api/chat-bots/:id/api-keys', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return { items: await chatBots.listApiKeys(id, request.auth!.userId) };
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.post('/api/chat-bots/:id/api-keys', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: string };
    try {
      const created = await chatBots.createApiKey(id, request.auth!.userId, body.name ?? 'API Key');
      return reply.status(201).send(created);
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.delete(
    '/api/chat-bots/:id/api-keys/:keyId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id, keyId } = request.params as { id: string; keyId: string };
      try {
        await chatBots.deleteApiKey(id, request.auth!.userId, keyId);
        return reply.status(204).send();
      } catch {
        return reply.status(404).send({ code: 'E1001', message: 'API key not found' });
      }
    },
  );

  app.get('/api/chat-bots/:id/publish-log', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const items = await chatBots.listPublishLog(id, request.auth!.userId);
      return {
        items: items.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    } catch {
      return reply.status(404).send({ code: 'E1001', message: 'Chat bot not found' });
    }
  });

  app.post('/api/chat-bots/:id/generate-config', { preHandler: authPreHandler }, async (request, reply) => {
    if (!ai) {
      return reply.status(503).send({ code: 'E3001', message: 'AI runtime unavailable' });
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { prompt?: string };
    const prompt = String(body.prompt ?? '');
    try {
      const draft = await chatBots.getDraftConfig(id, request.auth!.userId);
      const generated = await generateBotConfigFromPrompt(ai, prompt, draft);
      const next = await chatBots.updateDraftConfig(id, request.auth!.userId, generated.config);
      return { config: next, explanation: generated.explanation };
    } catch (err) {
      if (err instanceof AwfError) {
        const status = err.code === 'E3010' ? 502 : err.code === 'E1004' ? 400 : 404;
        return reply.status(status).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/chat-bots/:id/sessions', { preHandler: authPreHandler }, async (request, reply) => {
    if (!chatService) {
      return reply.status(503).send({ code: 'E3001', message: 'Chat service unavailable' });
    }
    const { id } = request.params as { id: string };
    const userId = request.auth!.userId;
    try {
      const { bot, version, config } = await chatBots.createOwnerSessionFromPublished(id, userId);
      const session = await chatService.createSession(userId, bot.name, {
        mode: config.mode,
        knowledgeBaseIds: config.knowledgeBaseIds,
        ragTemplate: config.ragTemplate,
        systemPrompt: config.systemPrompt,
        modelId: config.modelId,
        botId: bot.id,
        botVersionId: version.id,
      });
      return reply.status(201).send(session);
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: string }).code) : 'E1001';
      return reply.status(code === 'E1005' ? 403 : 404).send({
        code,
        message: err instanceof Error ? err.message : 'Not found',
      });
    }
  });

  /** Legacy alias for early clients */
  app.get('/api/chat/bots', { preHandler: authPreHandler }, async (request) => ({
    items: await chatBots.listBots(request.auth!.userId),
  }));
}
