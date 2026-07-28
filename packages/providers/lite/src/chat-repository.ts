import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { ChatRepository, ChatMessageRecord, ChatSessionRecord } from '@rxwf/chat';
import type { LiteDatabase } from './db.js';
import { chatMessages, chatSessions } from './drizzle/schema.js';

export function createLiteChatRepository(db: LiteDatabase): ChatRepository {
  return {
    async createSession(input) {
      const now = new Date();
      await db.insert(chatSessions).values({
        id: input.id,
        userId: input.userId,
        title: input.title,
        kind: input.kind ?? 'user',
        botId: input.botId ?? null,
        botVersionId: input.botVersionId ?? null,
        publicClientToken: input.publicClientToken ?? null,
        mode: input.mode ?? 'chat',
        knowledgeBaseIds: JSON.stringify(input.knowledgeBaseIds ?? []),
        ragTemplate: input.ragTemplate ?? 'support',
        systemPrompt: input.systemPrompt ?? '',
        modelId: input.modelId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return mapSession({
        id: input.id,
        userId: input.userId,
        title: input.title,
        kind: input.kind ?? 'user',
        botId: input.botId ?? null,
        botVersionId: input.botVersionId ?? null,
        publicClientToken: input.publicClientToken ?? null,
        mode: input.mode ?? 'chat',
        knowledgeBaseIds: JSON.stringify(input.knowledgeBaseIds ?? []),
        ragTemplate: input.ragTemplate ?? 'support',
        systemPrompt: input.systemPrompt ?? '',
        modelId: input.modelId ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    },

    async listSessions(userId) {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
        .orderBy(desc(chatSessions.updatedAt));
      return rows.map(mapSession);
    },

    async getSession(id, userId) {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, id),
            eq(chatSessions.userId, userId),
            isNull(chatSessions.deletedAt),
          ),
        )
        .limit(1);
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async getPublicSession(id, clientToken) {
      const rows = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.id, id),
            eq(chatSessions.publicClientToken, clientToken),
            eq(chatSessions.kind, 'public'),
            isNull(chatSessions.deletedAt),
          ),
        )
        .limit(1);
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async updateSession(id, userId, patch) {
      const existing = await this.getSession(id, userId);
      if (!existing) return null;
      const now = new Date();
      const next = {
        ...existing,
        ...patch,
        knowledgeBaseIds: patch.knowledgeBaseIds ?? existing.knowledgeBaseIds,
        updatedAt: now,
      };
      await db
        .update(chatSessions)
        .set({
          title: next.title,
          mode: next.mode,
          knowledgeBaseIds: JSON.stringify(next.knowledgeBaseIds),
          ragTemplate: next.ragTemplate,
          systemPrompt: next.systemPrompt,
          modelId: next.modelId ?? null,
          botId: next.botId,
          botVersionId: next.botVersionId,
          updatedAt: now,
        })
        .where(eq(chatSessions.id, id));
      return next;
    },

    async deleteSession(id, userId) {
      const existing = await this.getSession(id, userId);
      if (!existing) return false;
      const now = new Date();
      await db
        .update(chatSessions)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(chatSessions.id, id));
      return true;
    },

    async appendMessage(input) {
      const now = new Date();
      await db.insert(chatMessages).values({
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        citations: input.citations ? JSON.stringify(input.citations) : null,
        feedback: null,
        createdAt: now,
      });
      await db
        .update(chatSessions)
        .set({ updatedAt: now })
        .where(eq(chatSessions.id, input.sessionId));
      return {
        ...input,
        feedback: null,
        createdAt: now,
      };
    },

    async setMessageFeedback(messageId, sessionId, userId, feedback) {
      const session = await this.getSession(sessionId, userId);
      if (!session) return false;
      const rows = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(
          and(eq(chatMessages.id, messageId), eq(chatMessages.sessionId, sessionId)),
        )
        .limit(1);
      if (!rows[0]) return false;
      await db
        .update(chatMessages)
        .set({ feedback })
        .where(eq(chatMessages.id, messageId));
      return true;
    },

    async deleteMessagesFrom(sessionId, fromMessageId) {
      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);
      const idx = rows.findIndex((r) => r.id === fromMessageId);
      if (idx < 0) return false;
      const ids = rows.slice(idx).map((r) => r.id);
      if (ids.length === 0) return false;
      await db.delete(chatMessages).where(inArray(chatMessages.id, ids));
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));
      return true;
    },

    async listMessages(sessionId) {
      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);
      return rows.map(mapMessage);
    },
  };
}

function mapSession(row: typeof chatSessions.$inferSelect): ChatSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    kind: row.kind === 'public' ? 'public' : 'user',
    botId: row.botId ?? null,
    botVersionId: row.botVersionId ?? null,
    publicClientToken: row.publicClientToken ?? null,
    mode: (row.mode === 'rag' ? 'rag' : 'chat') as ChatSessionRecord['mode'],
    knowledgeBaseIds: JSON.parse(row.knowledgeBaseIds) as string[],
    ragTemplate: row.ragTemplate,
    systemPrompt: row.systemPrompt,
    modelId: row.modelId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: typeof chatMessages.$inferSelect): ChatMessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as ChatMessageRecord['role'],
    content: row.content,
    citations: row.citations
      ? (JSON.parse(row.citations) as ChatMessageRecord['citations'])
      : undefined,
    feedback: row.feedback as ChatMessageRecord['feedback'],
    createdAt: row.createdAt,
  };
}
