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
      return messages.filter((m) => m.sessionId === sessionId);
    },
  };
}

describe('createChatService', () => {
  it('streams assistant tokens after user message (AC-18)', async () => {
    const ai = {
      async *chat() {
        yield 'Hi ';
        yield 'there';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai });
    const session = await service.createSession('u1', 'Test');
    const chunks: string[] = [];
    for await (const ev of service.streamReply(session.id, 'u1', 'hello')) {
      if (ev.type === 'token') chunks.push(ev.token);
    }
    expect(chunks.join('')).toBe('Hi there');
  });

  it('emits thinking status before tokens in chat mode', async () => {
    const ai = {
      async *chat() {
        yield 'Hi';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai });
    const session = await service.createSession('u1', 'Test');
    const events: string[] = [];
    for await (const ev of service.streamReply(session.id, 'u1', 'hello')) {
      events.push(ev.type === 'status' ? `status:${ev.phase}` : ev.type);
    }
    expect(events).toContain('status:thinking');
    expect(events.indexOf('status:thinking')).toBeLessThan(events.indexOf('token'));
  });

  it('uses platform RAG default model when session has no modelId', async () => {
    const resolved: string[] = [];
    const ai = {
      async *chat(_messages: unknown[], opts?: { model?: { model?: string } }) {
        if (opts?.model?.model) resolved.push(opts.model.model);
        yield 'rag-answer';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({
      repo: memoryRepo(),
      ai,
      knowledge: {
        async queryMany() {
          return [
            {
              id: 'c1',
              knowledgeBaseId: 'kb1',
              documentId: 'd1',
              documentName: 'doc',
              chunkIndex: 0,
              text: 'context',
              score: 0.9,
              metadata: {},
            },
          ];
        },
      },
      catalog: {
        resolveModelRef: async (id) => ({ provider: 'ollama', model: `resolved:${id}` }),
        getDefaultChatModelId: async () => 'chat-default',
      },
      platform: {
        getRagDefaultModelId: async () => 'platform-rag-model',
      },
    });
    const session = await service.createSession('u1', 'RAG', {
      mode: 'rag',
      knowledgeBaseIds: ['kb-1'],
    });
    for await (const _ of service.streamReply(session.id, 'u1', 'question')) {
      /* drain */
    }
    expect(resolved).toEqual(['resolved:platform-rag-model']);
  });

  it('emits rag_search status before retrieval', async () => {
    const ai = {
      async *chat() {
        yield 'answer';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({
      repo: memoryRepo(),
      ai,
      knowledge: {
        async queryMany() {
          return [];
        },
      },
    });
    const session = await service.createSession('u1', 'RAG', {
      mode: 'rag',
      knowledgeBaseIds: ['kb-1'],
    });
    const events: string[] = [];
    for await (const ev of service.streamReply(session.id, 'u1', 'question')) {
      events.push(ev.type === 'status' ? `status:${ev.phase}` : ev.type);
    }
    expect(events).toContain('status:rag_search');
    expect(events).toContain('status:thinking');
  });

  it('throws E3001 when AI disabled', async () => {
    const ai = {
      async *chat() {
        const { AwfError } = await import('@rxwf/shared');
        throw new AwfError('E3001', 'disabled');
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai });
    const session = await service.createSession('u1', 'T');
    await expect(async () => {
      for await (const _ of service.streamReply(session.id, 'u1', 'x')) {
        /* drain */
      }
    }).rejects.toMatchObject({ code: 'E3001' });
  });

  it('deleteSession removes from listSessions', async () => {
    const ai = {
      async *chat() {
        yield 'ok';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai });
    const session = await service.createSession('u1', 'To delete');
    expect(await service.listSessions('u1')).toHaveLength(1);
    expect(await service.deleteSession(session.id, 'u1')).toBe(true);
    expect(await service.listSessions('u1')).toHaveLength(0);
    expect(await service.getSession(session.id, 'u1')).toBeNull();
  });

  it('streamReply uses resolved model when session.modelId set', async () => {
    let capturedModel: unknown;
    const ai: AiRuntime = {
      async *chat(_messages, opts) {
        capturedModel = opts?.model;
        yield 'ok';
      },
      async runAgent() {
        return { items: [] };
      },
    };
    const catalog = {
      async resolveModelRef(modelId: string) {
        return {
          provider: 'ollama',
          model: `resolved-${modelId}`,
          baseUrl: 'http://localhost:11434',
        };
      },
      async getDefaultChatModelId() {
        return 'default-model';
      },
    };
    const service = createChatService({ repo: memoryRepo(), ai, catalog });
    const session = await service.createSession('u1', 'Test', { modelId: 'my-model' });
    for await (const _ of service.streamReply(session.id, 'u1', 'hello')) {
      /* drain */
    }
    expect(capturedModel).toEqual({
      provider: 'ollama',
      model: 'resolved-my-model',
      baseUrl: 'http://localhost:11434',
    });
  });
});
