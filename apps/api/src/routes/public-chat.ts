import type { FastifyInstance } from 'fastify';
import type { ChatRepository } from '@rxwf/chat';
import type { ChatBotService } from '@rxwf/chat-bots';
import type { createChatService } from '@rxwf/chat';
import { AwfError } from '@rxwf/shared';
import { checkBotRateLimit, clientIp } from '../rate-limit/bot-rate-limit.js';

type ChatService = ReturnType<typeof createChatService>;

function writeSse(
  raw: NodeJS.WritableStream,
  ev: { type: string; [key: string]: unknown },
): void {
  raw.write(`data: ${JSON.stringify(ev)}\n\n`);
}

async function createPublicSession(
  chatBots: ChatBotService,
  chatRepo: ChatRepository,
  slug: string,
  channel: 'embed' | 'api',
) {
  const { bot, version } = await chatBots.requirePublishedForChannel(slug, channel);
  const clientToken = crypto.randomUUID();
  const cfg = version.config;
  const sessionId = crypto.randomUUID();

  await chatRepo.createSession({
    id: sessionId,
    userId: bot.ownerUserId,
    title: bot.name,
    kind: 'public',
    botId: bot.id,
    botVersionId: bot.publishedVersionId,
    publicClientToken: clientToken,
    mode: cfg.mode,
    knowledgeBaseIds: cfg.knowledgeBaseIds,
    ragTemplate: cfg.ragTemplate,
    systemPrompt: cfg.systemPrompt,
    modelId: cfg.modelId || null,
  });

  if (cfg.openingMessage?.trim()) {
    await chatRepo.appendMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: 'assistant',
      content: cfg.openingMessage.trim(),
    });
  }

  return {
    sessionId,
    clientToken,
    bot: { id: bot.id, name: bot.name, slug: bot.slug, themeColor: cfg.themeColor },
    openingMessage: cfg.openingMessage,
  };
}

export function registerPublicChatRoutes(
  app: FastifyInstance,
  chatService: ChatService,
  chatBots: ChatBotService,
  chatRepo: ChatRepository,
): void {
  app.post('/api/public/chat/:slug/session', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const ip = clientIp(request);
    const limit = checkBotRateLimit(`${ip}:${slug}:session`);
    if (!limit.allowed) {
      return reply.status(429).send({
        code: 'E1007',
        message: 'Rate limit exceeded',
        retryAfterSec: limit.retryAfterSec,
      });
    }

    try {
      const created = await createPublicSession(chatBots, chatRepo, slug, 'embed');
      return {
        sessionId: created.sessionId,
        clientToken: created.clientToken,
        bot: created.bot,
      };
    } catch (err) {
      if (err instanceof AwfError) {
        const status = err.code === 'E1005' ? 403 : 404;
        return reply.status(status).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.get('/api/public/chat/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const clientToken = String(request.headers['x-chat-client-token'] ?? '');
    if (!clientToken) {
      return reply.status(401).send({ code: 'E1006', message: 'x-chat-client-token required' });
    }
    try {
      return { messages: await chatService.listPublicMessages(id, clientToken) };
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(404).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/public/chat/sessions/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    const clientToken = String(request.headers['x-chat-client-token'] ?? '');
    if (!clientToken) {
      return reply.status(401).send({ code: 'E1006', message: 'x-chat-client-token required' });
    }
    const body = (request.body ?? {}) as { content?: string };
    const content = String(body.content ?? '');
    const ip = clientIp(request);
    const limit = checkBotRateLimit(`${ip}:${id}:stream`);
    if (!limit.allowed) {
      return reply.status(429).send({
        code: 'E1007',
        message: 'Rate limit exceeded',
        retryAfterSec: limit.retryAfterSec,
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const ac = new AbortController();
    request.raw.on('close', () => ac.abort());

    try {
      for await (const ev of chatService.streamPublicReply(id, clientToken, content, {
        signal: ac.signal,
      })) {
        writeSse(reply.raw, ev);
        if (ev.type === 'error' || ev.type === 'aborted') break;
      }
      reply.raw.write('data: [DONE]\n\n');
    } catch (err) {
      const code = err instanceof AwfError ? err.code : 'E3002';
      const message = err instanceof Error ? err.message : 'stream error';
      writeSse(reply.raw, { type: 'error', code, message });
    } finally {
      reply.raw.end();
    }
  });

  app.post('/api/public/chat/bots/:slug/chat', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const auth = request.headers.authorization;
    const ip = clientIp(request);
    const limit = checkBotRateLimit(`${ip}:${slug}:api`);
    if (!limit.allowed) {
      return reply.status(429).send({
        code: 'E1007',
        message: 'Rate limit exceeded',
        retryAfterSec: limit.retryAfterSec,
      });
    }

    const body = (request.body ?? {}) as { message?: string; sessionId?: string };
    const message = String(body.message ?? '').trim();
    if (!message) {
      return reply.status(400).send({ code: 'E1004', message: 'message required' });
    }

    try {
      const bot = await chatBots.verifyApiKey(typeof auth === 'string' ? auth : undefined);
      if (!bot) {
        return reply.status(401).send({ code: 'E1006', message: 'Invalid API key' });
      }
      if (bot.slug !== slug) {
        return reply.status(403).send({ code: 'E1006', message: 'API key does not match bot' });
      }
      await chatBots.requirePublishedForChannel(slug, 'api');

      let sessionId = body.sessionId;
      let clientToken = String(request.headers['x-chat-client-token'] ?? '');
      if (!sessionId) {
        const created = await createPublicSession(chatBots, chatRepo, slug, 'api');
        sessionId = created.sessionId;
        clientToken = created.clientToken;
      }
      if (!clientToken) {
        return reply.status(400).send({
          code: 'E1004',
          message: 'x-chat-client-token required when reusing sessionId',
        });
      }

      let answer = '';
      let citations: unknown[] | undefined;
      for await (const ev of chatService.streamPublicReply(sessionId, clientToken, message)) {
        if (ev.type === 'token') answer += ev.token;
        if (ev.type === 'done') citations = ev.citations;
        if (ev.type === 'error') {
          return reply.status(400).send({ code: ev.code, message: ev.message });
        }
      }
      return { sessionId, clientToken, answer, citations: citations ?? [] };
    } catch (err) {
      if (err instanceof AwfError) {
        const status =
          err.code === 'E1006' ? 401 : err.code === 'E1005' ? 403 : err.code === 'E1007' ? 429 : 400;
        return reply.status(status).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });
}
