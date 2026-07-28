import type { FastifyInstance } from 'fastify';

import type { createChatService } from '@rxwf/chat';

import { AwfError } from '@rxwf/shared';

import type { createAuthPreHandler } from '../middleware/auth.js';



type ChatService = ReturnType<typeof createChatService>;



export function registerChatRoutes(

  app: FastifyInstance,

  authPreHandler: ReturnType<typeof createAuthPreHandler>,

  chatService: ChatService,

): void {

  app.post('/api/chat/sessions', { preHandler: authPreHandler }, async (request, reply) => {

    const userId = request.auth!.userId;

    const body = (request.body ?? {}) as {

      title?: string;

      mode?: 'chat' | 'rag';

      knowledgeBaseIds?: string[];

      ragTemplate?: string;

      botId?: string;

      botVersionId?: string;

      systemPrompt?: string;

      modelId?: string | null;

    };

    const session = await chatService.createSession(userId, body.title ?? 'New chat', {

      mode: body.mode,

      knowledgeBaseIds: body.knowledgeBaseIds,

      ragTemplate: body.ragTemplate,

      botId: body.botId,

      botVersionId: body.botVersionId,

      systemPrompt: body.systemPrompt,

      modelId: body.modelId,

    });

    return reply.status(201).send(session);

  });



  app.get('/api/chat/sessions', { preHandler: authPreHandler }, async (request) => {

    const userId = request.auth!.userId;

    return { sessions: await chatService.listSessions(userId) };

  });



  app.delete('/api/chat/sessions/:id', { preHandler: authPreHandler }, async (request, reply) => {

    const { id } = request.params as { id: string };

    const deleted = await chatService.deleteSession(id, request.auth!.userId);

    if (!deleted) {

      return reply.status(404).send({ code: 'E1001', message: 'Chat session not found' });

    }

    return reply.status(204).send();

  });



  app.patch('/api/chat/sessions/:id', { preHandler: authPreHandler }, async (request, reply) => {

    const { id } = request.params as { id: string };

    const body = (request.body ?? {}) as {

      title?: string;

      mode?: 'chat' | 'rag';

      knowledgeBaseIds?: string[];

      ragTemplate?: string;

      modelId?: string | null;

    };

    const updated = await chatService.updateSession(id, request.auth!.userId, body);

    if (!updated) {

      return reply.status(404).send({ code: 'E1001', message: 'Chat session not found' });

    }

    return updated;

  });



  app.get('/api/chat/sessions/:id/messages', { preHandler: authPreHandler }, async (request, reply) => {

    const { id } = request.params as { id: string };

    try {

      const messages = await chatService.listMessages(id, request.auth!.userId);

      return { messages };

    } catch (err) {

      if (err instanceof AwfError && err.code === 'E1001') {

        return reply.status(404).send({ code: err.code, message: err.message });

      }

      throw err;

    }

  });



  app.post(

    '/api/chat/sessions/:id/messages/:messageId/feedback',

    { preHandler: authPreHandler },

    async (request, reply) => {

      const { id, messageId } = request.params as { id: string; messageId: string };

      const body = (request.body ?? {}) as { feedback?: 'up' | 'down' };

      if (body.feedback !== 'up' && body.feedback !== 'down') {

        return reply.status(400).send({ code: 'E1004', message: 'feedback must be up or down' });

      }

      const ok = await chatService.setMessageFeedback(

        id,

        messageId,

        request.auth!.userId,

        body.feedback,

      );

      if (!ok) {

        return reply.status(404).send({ code: 'E1001', message: 'Message not found' });

      }

      return { ok: true };

    },

  );



  app.post(
    '/api/chat/sessions/:id/messages/:messageId/regenerate',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id, messageId } = request.params as { id: string; messageId: string };
      const body = (request.body ?? {}) as {
        mode?: 'chat' | 'rag';
        fallbackToChat?: boolean;
        modelId?: string;
      };

      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const ac = new AbortController();
      request.raw.on('close', () => ac.abort());

      try {
        for await (const ev of chatService.streamRegenerate(id, request.auth!.userId, messageId, {
          mode: body.mode,
          fallbackToChat: body.fallbackToChat,
          modelId: body.modelId,
          signal: ac.signal,
        })) {
          if (ev.type === 'error' || ev.type === 'aborted') {
            reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
            break;
          }
          reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
        reply.raw.write('data: [DONE]\n\n');
      } catch (err) {
        const code = err instanceof AwfError ? err.code : 'E3002';
        const message = err instanceof Error ? err.message : 'stream error';
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', code, message })}\n\n`);
      }

      reply.raw.end();
      return reply;
    },
  );

  app.post('/api/chat/sessions/:id/stream', { preHandler: authPreHandler }, async (request, reply) => {

    const { id } = request.params as { id: string };

    const body = (request.body ?? {}) as {

      content?: string;

      mode?: 'chat' | 'rag';

      fallbackToChat?: boolean;

      modelId?: string;

    };

    const content = String(body.content ?? '');

    reply.hijack();

    reply.raw.writeHead(200, {

      'Content-Type': 'text/event-stream',

      'Cache-Control': 'no-cache',

      Connection: 'keep-alive',

    });

    const ac = new AbortController();

    request.raw.on('close', () => ac.abort());

    try {

      for await (const ev of chatService.streamReply(id, request.auth!.userId, content, {

        mode: body.mode,

        fallbackToChat: body.fallbackToChat,

        modelId: body.modelId,

        signal: ac.signal,

      })) {

        if (ev.type === 'error') {

          reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);

          break;

        }

        if (ev.type === 'aborted') {

          reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);

          break;

        }

        reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);

      }

      reply.raw.write('data: [DONE]\n\n');

    } catch (err) {

      const code = err instanceof AwfError ? err.code : 'E3002';

      const message = err instanceof Error ? err.message : 'stream error';

      reply.raw.write(`data: ${JSON.stringify({ type: 'error', code, message })}\n\n`);

    }

    reply.raw.end();

    return reply;

  });

}

