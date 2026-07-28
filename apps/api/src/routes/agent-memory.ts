import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AgentMemoryRepository } from '@rxwf/providers-contracts';



function parseLimit(value: string | undefined, fallback: number, max: number): number {

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(1, Math.min(max, Math.floor(parsed)));

}



function parseOffset(value: string | undefined): number {

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 0;

  return Math.max(0, Math.floor(parsed));

}

/** SQLite min/max aggregates may treat Unix seconds as milliseconds. */
function fixSqliteAggregateDate(date: Date): Date {
  if (date.getUTCFullYear() >= 1980) return date;
  const raw = date.getTime();
  if (raw > 0 && raw < 1_000_000_000_000) return new Date(raw * 1000);
  return date;
}



export function registerAgentMemoryRoutes(

  app: FastifyInstance,

  agentMemory: AgentMemoryRepository,

  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,

): void {

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {

    await authPreHandler(request, reply);

    if (reply.sent) return;

    if (request.auth?.role !== 'admin') {

      await reply.status(403).send({ code: 'E5002', message: 'Admin required' });

    }

  };



  app.get(

    '/api/agent-memory/sessions',

    { preHandler: requireAdmin },

    async (request) => {

      const query = request.query as { limit?: string; offset?: string; search?: string };

      const limit = parseLimit(query.limit, 20, 100);

      const offset = parseOffset(query.offset);

      const search = String(query.search ?? '').trim() || undefined;

      const result = await agentMemory.listSessions({ limit, offset, search });

      return {

        items: result.items.map((item) => ({

          sessionId: item.sessionId,

          messageCount: item.messageCount,

          firstMessageAt: fixSqliteAggregateDate(item.firstMessageAt).toISOString(),

          lastMessageAt: fixSqliteAggregateDate(item.lastMessageAt).toISOString(),

        })),

        total: result.total,

        limit,

        offset,

      };

    },

  );



  app.get(

    '/api/agent-memory/sessions/:sessionId/messages',

    { preHandler: authPreHandler },

    async (request, reply) => {

      const sessionId = String((request.params as { sessionId?: string }).sessionId ?? '').trim();

      if (!sessionId) {

        return reply.status(400).send({

          code: 'E1001',

          message: 'sessionId is required',

        });

      }

      const query = request.query as { limit?: string; offset?: string };

      const parsedLimit = Number(query.limit);

      const limit = Number.isFinite(parsedLimit)

        ? Math.max(1, Math.min(500, Math.floor(parsedLimit)))

        : 40;

      const offset = parseOffset(query.offset);

      const rows =

        offset > 0 || limit > 40

          ? await agentMemory.listAllMessages(sessionId, { limit, offset })

          : await agentMemory.listRecent(sessionId, limit);

      return {

        sessionId,

        messages: rows.map((row) => ({

          id: row.id,

          role: row.role,

          content: row.content,

          createdAt: row.createdAt.toISOString(),

          ...(row.executionId ? { executionId: row.executionId } : {}),

        })),

        limit,

        offset,

      };

    },

  );



  app.delete(

    '/api/agent-memory/sessions/:sessionId',

    { preHandler: requireAdmin },

    async (request, reply) => {

      const sessionId = String((request.params as { sessionId?: string }).sessionId ?? '').trim();

      if (!sessionId) {

        return reply.status(400).send({

          code: 'E1001',

          message: 'sessionId is required',

        });

      }

      const deleted = await agentMemory.deleteSession(sessionId);

      return reply.status(200).send({ sessionId, deleted });

    },

  );



  app.delete(

    '/api/agent-memory/sessions/:sessionId/messages/:messageId',

    { preHandler: requireAdmin },

    async (request, reply) => {

      const sessionId = String((request.params as { sessionId?: string }).sessionId ?? '').trim();

      const messageId = String(

        (request.params as { messageId?: string }).messageId ?? '',

      ).trim();

      if (!sessionId || !messageId) {

        return reply.status(400).send({

          code: 'E1001',

          message: 'sessionId and messageId are required',

        });

      }

      const deleted = await agentMemory.deleteMessage(messageId);

      if (!deleted) {

        return reply.status(404).send({

          code: 'E1004',

          message: 'Message not found',

        });

      }

      return reply.status(204).send();

    },

  );

}


