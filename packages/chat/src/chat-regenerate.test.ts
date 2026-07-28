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
    async getPublicSession() {
      return null;
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
    async setMessageFeedback() {
      return true;
    },
    async deleteMessagesFrom(sessionId, fromMessageId) {
      const ordered = messages
        .filter((m) => m.sessionId === sessionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const idx = ordered.findIndex((m) => m.id === fromMessageId);
      if (idx < 0) return false;
      const removeIds = new Set(ordered.slice(idx).map((m) => m.id));
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.sessionId === sessionId && removeIds.has(messages[i]!.id)) {
          messages.splice(i, 1);
        }
      }
      return true;
    },
    async listMessages(sessionId) {
      return messages
        .filter((m) => m.sessionId === sessionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  };
}

describe('streamRegenerate', () => {
  it('removes assistant and later messages then streams a new reply', async () => {
    const replies = ['First', 'Second', 'Regenerated'];
    let call = 0;
    const ai: AiRuntime = {
      async *chat() {
        yield replies[call++] ?? 'More';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai });
    const session = await service.createSession('u1', 'Regen');

    for await (const _ of service.streamReply(session.id, 'u1', 'hello')) {
      /* drain first reply */
    }
    const firstAssistant = (await service.listMessages(session.id, 'u1')).find(
      (m) => m.role === 'assistant',
    );
    expect(firstAssistant?.content).toBe('First');

    for await (const _ of service.streamReply(session.id, 'u1', 'follow up')) {
      /* drain second turn */
    }

    const tokens: string[] = [];
    for await (const ev of service.streamRegenerate(session.id, 'u1', firstAssistant!.id)) {
      if (ev.type === 'token') tokens.push(ev.token);
    }

    expect(tokens.join('')).toBe('Regenerated');
    const after = await service.listMessages(session.id, 'u1');
    expect(after.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(after[0]?.content).toBe('hello');
    expect(after[1]?.content).toBe('Regenerated');
  });
});
