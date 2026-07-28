import { describe, it, expect } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { createChatService } from './chat-service.js';
import type { ChatRepository } from './chat-repository.js';

function memoryRepo(): ChatRepository {
  const sessions = new Map<string, import('./chat-repository.js').ChatSessionRecord>();
  const deleted = new Set<string>();
  const messages: import('./chat-repository.js').ChatMessageRecord[] = [];
  return {
    async createSession(input) {
      const now = new Date();
      const rec = {
        id: input.id,
        userId: input.userId,
        title: input.title,
        kind: input.kind ?? 'user',
        botId: input.botId ?? null,
        botVersionId: input.botVersionId ?? null,
        publicClientToken: input.publicClientToken ?? null,
        mode: input.mode ?? 'chat',
        knowledgeBaseIds: input.knowledgeBaseIds ?? [],
        ragTemplate: input.ragTemplate ?? 'support',
        systemPrompt: input.systemPrompt ?? '',
        modelId: input.modelId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(input.id, rec);
      return rec;
    },
    async listSessions(userId) {
      return [...sessions.values()].filter((s) => s.userId === userId && !deleted.has(s.id));
    },
    async getSession(id, userId) {
      const s = sessions.get(id);
      if (!s || s.userId !== userId || deleted.has(id)) return null;
      return s;
    },
    async updateSession(id, userId, patch) {
      const s = await this.getSession(id, userId);
      if (!s) return null;
      const next = { ...s, ...patch, updatedAt: new Date() };
      sessions.set(id, next);
      return next;
    },
    async deleteSession(id, userId) {
      const s = await this.getSession(id, userId);
      if (!s) return false;
      deleted.add(id);
      return true;
    },
    async appendMessage(input) {
      const rec = { ...input, createdAt: new Date(), feedback: null };
      messages.push(rec);
      return rec;
    },
    async getPublicSession() {
      return null;
    },
    async setMessageFeedback() {
      return true;
    },
    async deleteMessagesFrom() {
      return false;
    },
    async listMessages(sessionId) {
      return messages.filter((m) => m.sessionId === sessionId);
    },
  };
}

describe('stream abort', () => {
  it('does not persist partial assistant on abort', async () => {
    const ai: AiRuntime = {
      async *chat(_messages, opts) {
        yield 'He';
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (opts?.signal?.aborted) return;
        yield 'llo';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const repo = memoryRepo();
    const service = createChatService({ repo, ai });
    const session = await service.createSession('u1', 'Test');
    const ac = new AbortController();

    const events: string[] = [];
    for await (const ev of service.streamReply(session.id, 'u1', 'hello', {
      signal: ac.signal,
    })) {
      events.push(ev.type);
      if (ev.type === 'token' && ev.token === 'He') {
        ac.abort();
      }
    }

    expect(events).toContain('aborted');
    const messages = await service.listMessages(session.id, 'u1');
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
    expect(messages.filter((m) => m.role === 'user')).toHaveLength(1);
  });
});
