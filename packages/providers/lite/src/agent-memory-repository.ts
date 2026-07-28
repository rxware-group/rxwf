import { asc, desc, eq, like, sql } from 'drizzle-orm';
import type {
  AgentMemoryAppendInput,
  AgentMemoryListMessagesOptions,
  AgentMemoryListSessionsOptions,
  AgentMemoryMessageRecord,
  AgentMemoryRepository,
  AgentMemorySessionSummary,
} from '@rxwf/providers-contracts';
import type { LiteDatabase } from './db.js';
import { agentSessionMessages } from './drizzle/schema.js';

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/** Drizzle SQLite `timestamp` columns store Unix seconds; SQL aggregates bypass column mappers. */
function fromSqliteAggregateTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return new Date(NaN);
  return new Date(n < 1_000_000_000_000 ? n * 1000 : n);
}

function mapRow(row: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  executionId: string | null;
  createdAt: Date;
}): AgentMemoryMessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as AgentMemoryMessageRecord['role'],
    content: row.content,
    executionId: row.executionId ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapSessionSummary(row: {
  sessionId: string;
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
}): AgentMemorySessionSummary {
  return {
    sessionId: row.sessionId,
    messageCount: row.messageCount,
    firstMessageAt: row.firstMessageAt,
    lastMessageAt: row.lastMessageAt,
  };
}

export function createLiteAgentMemoryRepository(db: LiteDatabase): AgentMemoryRepository {
  return {
    async append(input: AgentMemoryAppendInput): Promise<AgentMemoryMessageRecord> {
      const id = crypto.randomUUID();
      const createdAt = new Date();
      await db.insert(agentSessionMessages).values({
        id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        executionId: input.executionId,
        createdAt,
      });
      return {
        id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        executionId: input.executionId,
        createdAt,
      };
    },

    async listRecent(sessionId: string, limit: number): Promise<AgentMemoryMessageRecord[]> {
      const rows = await db
        .select()
        .from(agentSessionMessages)
        .where(eq(agentSessionMessages.sessionId, sessionId))
        .orderBy(desc(agentSessionMessages.createdAt))
        .limit(Math.max(1, limit));
      return rows.map(mapRow).reverse();
    },

    async listSessions(options: AgentMemoryListSessionsOptions = {}) {
      const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
      const offset = Math.max(0, Math.floor(options.offset ?? 0));
      const search = options.search?.trim();
      const searchFilter = search
        ? like(agentSessionMessages.sessionId, `%${escapeLikePattern(search)}%`)
        : undefined;

      const totalRows = await db
        .select({
          count: sql<number>`count(distinct ${agentSessionMessages.sessionId})`,
        })
        .from(agentSessionMessages)
        .where(searchFilter);
      const total = Number(totalRows[0]?.count ?? 0);

      const rows = await db
        .select({
          sessionId: agentSessionMessages.sessionId,
          messageCount: sql<number>`count(*)`.mapWith(Number),
          firstMessageAt: sql<Date>`min(${agentSessionMessages.createdAt})`.mapWith(
            fromSqliteAggregateTimestamp,
          ),
          lastMessageAt: sql<Date>`max(${agentSessionMessages.createdAt})`.mapWith(
            fromSqliteAggregateTimestamp,
          ),
        })
        .from(agentSessionMessages)
        .where(searchFilter)
        .groupBy(agentSessionMessages.sessionId)
        .orderBy(desc(sql`max(${agentSessionMessages.createdAt})`))
        .limit(limit)
        .offset(offset);

      return {
        items: rows.map(mapSessionSummary),
        total,
      };
    },

    async listAllMessages(sessionId: string, options: AgentMemoryListMessagesOptions = {}) {
      const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? 200)));
      const offset = Math.max(0, Math.floor(options.offset ?? 0));
      const rows = await db
        .select()
        .from(agentSessionMessages)
        .where(eq(agentSessionMessages.sessionId, sessionId))
        .orderBy(asc(agentSessionMessages.createdAt))
        .limit(limit)
        .offset(offset);
      return rows.map(mapRow);
    },

    async deleteSession(sessionId: string): Promise<number> {
      const deleted = await db
        .delete(agentSessionMessages)
        .where(eq(agentSessionMessages.sessionId, sessionId))
        .returning({ id: agentSessionMessages.id });
      return deleted.length;
    },

    async deleteMessage(id: string): Promise<boolean> {
      const deleted = await db
        .delete(agentSessionMessages)
        .where(eq(agentSessionMessages.id, id))
        .returning({ id: agentSessionMessages.id });
      return deleted.length > 0;
    },
  };
}
