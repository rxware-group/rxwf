import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import type { ResolvedChatConfig } from '@rxwf/chat-bots';
import type { ScoredChunk } from '@rxwf/providers-contracts';
import {
  buildRagSystemPrompt,
  chunksToCitations,
  type RagTemplateId,
} from '@rxwf/knowledge';
import { AwfError } from '@rxwf/shared';
import type { ChatCitation, ChatRepository, ChatSessionRecord } from './chat-repository.js';

export type ChatProcessingPhase = 'rag_search' | 'rag_fallback' | 'thinking';

export type ChatStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'status'; phase: ChatProcessingPhase; detail?: string }
  | { type: 'done'; messageId: string; citations?: ChatCitation[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'aborted' };

export interface KnowledgeQueryPort {
  queryMany(knowledgeBaseIds: string[], queryText: string): Promise<ScoredChunk[]>;
}

export interface ModelCatalogPort {
  resolveModelRef(modelId: string): Promise<ModelRef>;
  getDefaultChatModelId(): Promise<string | null>;
}

export interface KnowledgePlatformPort {
  getRagDefaultModelId(): Promise<string | null>;
}

export interface ChatBotRuntimePort {
  getDraftConfig(botId: string, ownerUserId: string): Promise<ResolvedChatConfig>;
  resolvePublishedConfig(versionId: string): Promise<ResolvedChatConfig>;
  resolveForSession(input: {
    botId?: string | null;
    botVersionId?: string | null;
    ownerUserId?: string;
    sessionFallback: ResolvedChatConfig;
  }): Promise<ResolvedChatConfig>;
}

export function createChatService(deps: {
  repo: ChatRepository;
  ai: AiRuntime;
  knowledge?: KnowledgeQueryPort;
  bots?: ChatBotRuntimePort;
  catalog?: ModelCatalogPort;
  platform?: KnowledgePlatformPort;
}) {
  const { repo, ai, knowledge, bots, catalog, platform } = deps;

  async function resolveModel(
    session: ChatSessionRecord,
    modelIdOverride?: string,
    effective?: ResolvedChatConfig,
  ): Promise<ModelRef | undefined> {
    if (!catalog) return undefined;
    const modelId = modelIdOverride ?? effective?.modelId ?? session.modelId;
    if (modelId) {
      return catalog.resolveModelRef(modelId);
    }
    const mode = effective?.mode ?? session.mode;
    if (mode === 'rag' && platform) {
      const ragModelId = await platform.getRagDefaultModelId();
      if (ragModelId) {
        return catalog.resolveModelRef(ragModelId);
      }
    }
    const defaultId = await catalog.getDefaultChatModelId();
    if (defaultId) {
      return catalog.resolveModelRef(defaultId);
    }
    return undefined;
  }

  function sessionFallback(session: ChatSessionRecord): ResolvedChatConfig {
    return {
      mode: session.mode,
      knowledgeBaseIds: session.knowledgeBaseIds,
      ragTemplate: session.ragTemplate,
      systemPrompt: session.systemPrompt,
      modelId: session.modelId,
      fallbackToChat: true,
    };
  }

  async function effectiveConfig(session: ChatSessionRecord): Promise<ResolvedChatConfig> {
    const fallback = sessionFallback(session);
    if (!bots) return fallback;
    return bots.resolveForSession({
      botVersionId: session.botVersionId,
      botId: session.botId,
      ownerUserId: session.userId,
      sessionFallback: fallback,
    });
  }

  return {
    async createSession(
      userId: string,
      title: string,
      opts?: {
        mode?: 'chat' | 'rag';
        knowledgeBaseIds?: string[];
        ragTemplate?: string;
        systemPrompt?: string;
        botId?: string;
        botVersionId?: string;
        modelId?: string | null;
      },
    ) {
      let mode = opts?.mode;
      let knowledgeBaseIds = opts?.knowledgeBaseIds;
      let ragTemplate = opts?.ragTemplate;
      let systemPrompt = opts?.systemPrompt ?? '';
      let modelId = opts?.modelId ?? null;
      let botId: string | null = opts?.botId ?? null;
      let botVersionId: string | null = opts?.botVersionId ?? null;

      if (opts?.botVersionId && bots) {
        const resolved = await bots.resolvePublishedConfig(opts.botVersionId);
        mode = resolved.mode;
        knowledgeBaseIds = resolved.knowledgeBaseIds;
        ragTemplate = resolved.ragTemplate;
        systemPrompt = resolved.systemPrompt;
        modelId = resolved.modelId;
        botVersionId = opts.botVersionId;
      } else if (opts?.botId && bots) {
        const resolved = await bots.getDraftConfig(opts.botId, userId);
        mode = resolved.mode;
        knowledgeBaseIds = resolved.knowledgeBaseIds;
        ragTemplate = resolved.ragTemplate;
        systemPrompt = resolved.systemPrompt;
        modelId = resolved.modelId;
        botId = opts.botId;
      }

      const id = crypto.randomUUID();
      return repo.createSession({
        id,
        userId,
        title: title || 'New chat',
        kind: 'user',
        botId,
        botVersionId,
        publicClientToken: null,
        mode,
        knowledgeBaseIds,
        ragTemplate,
        systemPrompt,
        modelId,
      });
    },

    listSessions(userId: string) {
      return repo.listSessions(userId);
    },

    getSession(id: string, userId: string) {
      return repo.getSession(id, userId);
    },

    updateSession(
      id: string,
      userId: string,
      patch: Parameters<ChatRepository['updateSession']>[2],
    ) {
      return repo.updateSession(id, userId, patch);
    },

    deleteSession(id: string, userId: string) {
      return repo.deleteSession(id, userId);
    },

    listMessages(sessionId: string, userId: string) {
      return repo.getSession(sessionId, userId).then((s) => {
        if (!s) throw new AwfError('E1001', 'Chat session not found');
        return repo.listMessages(sessionId);
      });
    },

    setMessageFeedback(
      sessionId: string,
      messageId: string,
      userId: string,
      feedback: 'up' | 'down',
    ) {
      return repo.setMessageFeedback(messageId, sessionId, userId, feedback);
    },

    async *streamRegenerate(
      sessionId: string,
      userId: string,
      assistantMessageId: string,
      opts?: {
        mode?: 'chat' | 'rag';
        fallbackToChat?: boolean;
        modelId?: string;
        signal?: AbortSignal;
      },
    ): AsyncGenerator<ChatStreamEvent, void, unknown> {
      const session = await repo.getSession(sessionId, userId);
      if (!session) {
        throw new AwfError('E1001', 'Chat session not found');
      }

      const messages = await repo.listMessages(sessionId);
      const idx = messages.findIndex((m) => m.id === assistantMessageId);
      if (idx < 0) {
        throw new AwfError('E1001', 'Message not found');
      }
      if (messages[idx]!.role !== 'assistant') {
        throw new AwfError('E1004', 'Can only regenerate assistant messages');
      }

      let userContent = '';
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i]!.role === 'user') {
          userContent = messages[i]!.content;
          break;
        }
      }
      if (!userContent) {
        throw new AwfError('E1004', 'No user message to regenerate from');
      }

      const truncated = await repo.deleteMessagesFrom(sessionId, assistantMessageId);
      if (!truncated) {
        throw new AwfError('E1001', 'Message not found');
      }

      const effective = await effectiveConfig(session);
      const mode = opts?.mode ?? effective.mode;
      const fallbackToChat = opts?.fallbackToChat ?? effective.fallbackToChat;
      const streamOpts = { skipUserAppend: true as const, signal: opts?.signal };

      if (mode === 'rag') {
        yield* streamRag(
          session,
          userContent,
          effective,
          fallbackToChat,
          opts?.modelId,
          streamOpts,
        );
        return;
      }
      yield* streamPlain(session, userContent, effective, opts?.modelId, streamOpts);
    },

    async listPublicMessages(sessionId: string, clientToken: string) {
      const session = await repo.getPublicSession(sessionId, clientToken);
      if (!session) throw new AwfError('E1001', 'Chat session not found');
      return repo.listMessages(sessionId);
    },

    async *streamReply(
      sessionId: string,
      userId: string,
      userContent: string,
      opts?: {
        mode?: 'chat' | 'rag';
        fallbackToChat?: boolean;
        modelId?: string;
        signal?: AbortSignal;
      },
    ): AsyncGenerator<ChatStreamEvent, void, unknown> {
      const session = await repo.getSession(sessionId, userId);
      if (!session) {
        throw new AwfError('E1001', 'Chat session not found');
      }
      const effective = await effectiveConfig(session);
      const mode = opts?.mode ?? effective.mode;
      const fallbackToChat = opts?.fallbackToChat ?? effective.fallbackToChat;
      if (mode === 'rag') {
        yield* streamRag(session, userContent, effective, fallbackToChat, opts?.modelId, {
          signal: opts?.signal,
        });
        return;
      }
      yield* streamPlain(session, userContent, effective, opts?.modelId, {
        signal: opts?.signal,
      });
    },

    async collectReply(
      sessionId: string,
      userId: string,
      userContent: string,
      opts?: {
        mode?: 'chat' | 'rag';
        fallbackToChat?: boolean;
        modelId?: string;
        signal?: AbortSignal;
      },
    ) {
      let answer = '';
      let messageId = '';
      let citations: ChatCitation[] | undefined;
      for await (const ev of this.streamReply(sessionId, userId, userContent, opts)) {
        if (ev.type === 'token') answer += ev.token;
        if (ev.type === 'done') {
          messageId = ev.messageId;
          citations = ev.citations;
        }
        if (ev.type === 'error') {
          throw new AwfError(ev.code, ev.message);
        }
        if (ev.type === 'aborted') {
          throw new AwfError('E3002', 'Reply aborted');
        }
      }
      return { answer, messageId, citations };
    },

    async collectPublicReply(sessionId: string, clientToken: string, userContent: string) {
      let answer = '';
      let messageId = '';
      let citations: ChatCitation[] | undefined;
      for await (const ev of this.streamPublicReply(sessionId, clientToken, userContent)) {
        if (ev.type === 'token') answer += ev.token;
        if (ev.type === 'done') {
          messageId = ev.messageId;
          citations = ev.citations;
        }
        if (ev.type === 'error') {
          throw new AwfError(ev.code, ev.message);
        }
        if (ev.type === 'aborted') {
          throw new AwfError('E3002', 'Reply aborted');
        }
      }
      return { answer, messageId, citations };
    },

    async *streamPublicReply(
      sessionId: string,
      clientToken: string,
      userContent: string,
      opts?: { signal?: AbortSignal },
    ): AsyncGenerator<ChatStreamEvent, void, unknown> {
      const session = await repo.getPublicSession(sessionId, clientToken);
      if (!session) {
        throw new AwfError('E1001', 'Chat session not found');
      }
      if (!session.botVersionId) {
        throw new AwfError('E1005', 'Session missing published bot snapshot');
      }
      const effective = await effectiveConfig(session);
      if (effective.mode === 'rag') {
        yield* streamRag(session, userContent, effective, effective.fallbackToChat, undefined, {
          signal: opts?.signal,
        });
        return;
      }
      yield* streamPlain(session, userContent, effective, undefined, { signal: opts?.signal });
    },
  };

  async function* streamPlain(
    session: ChatSessionRecord,
    userContent: string,
    effective: ResolvedChatConfig,
    modelIdOverride?: string,
    opts?: { signal?: AbortSignal; skipUserAppend?: boolean },
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const signal = opts?.signal;
    if (!opts?.skipUserAppend) {
      await repo.appendMessage({
        id: crypto.randomUUID(),
        sessionId: session.id,
        role: 'user',
        content: userContent,
      });
    }
    const history = await repo.listMessages(session.id);
    const modelRef = await resolveModel(session, modelIdOverride, effective);
    const chatOpts = modelRef ? { model: modelRef, signal } : signal ? { signal } : undefined;
    let assistantText = '';
    try {
      yield { type: 'status', phase: 'thinking' };
      for await (const token of ai.chat(
        history.map((m) => ({ role: m.role, content: m.content })),
        chatOpts,
      )) {
        assistantText += token;
        yield { type: 'token', token };
        if (signal?.aborted) {
          yield { type: 'aborted' };
          return;
        }
      }
    } catch (err) {
      if (err instanceof AwfError) throw err;
      throw new AwfError('E3002', err instanceof Error ? err.message : 'AI error');
    }
    if (signal?.aborted) {
      yield { type: 'aborted' };
      return;
    }
    const msgId = crypto.randomUUID();
    await repo.appendMessage({
      id: msgId,
      sessionId: session.id,
      role: 'assistant',
      content: assistantText,
    });
    yield { type: 'done', messageId: msgId };
  }

  async function* streamRag(
    session: ChatSessionRecord,
    userContent: string,
    effective: ResolvedChatConfig,
    fallbackToChat?: boolean,
    modelIdOverride?: string,
    opts?: { signal?: AbortSignal; skipUserAppend?: boolean },
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const signal = opts?.signal;
    if (!knowledge) {
      throw new AwfError('E3001', 'Knowledge RAG is not configured');
    }
    if (effective.knowledgeBaseIds.length === 0) {
      throw new AwfError('E1004', 'Select at least one knowledge base for RAG mode');
    }

    if (!opts?.skipUserAppend) {
      await repo.appendMessage({
        id: crypto.randomUUID(),
        sessionId: session.id,
        role: 'user',
        content: userContent,
      });
    }

    let chunks;
    try {
      yield {
        type: 'status',
        phase: 'rag_search',
        detail: String(effective.knowledgeBaseIds.length),
      };
      chunks = await knowledge.queryMany(effective.knowledgeBaseIds, userContent);
    } catch (err) {
      if (fallbackToChat) {
        yield { type: 'status', phase: 'rag_fallback' };
        yield* streamPlain(session, userContent, { ...effective, mode: 'chat' }, modelIdOverride, {
          signal,
          skipUserAppend: true,
        });
        return;
      }
      throw err;
    }

    const citations = chunksToCitations(chunks);
    const templateId = (effective.ragTemplate in { support: 1, code: 1 }
      ? effective.ragTemplate
      : 'support') as RagTemplateId;
    let systemPrompt = buildRagSystemPrompt(chunks, templateId);
    if (effective.systemPrompt.trim()) {
      systemPrompt = `${effective.systemPrompt.trim()}\n\n${systemPrompt}`;
    }
    const history = await repo.listMessages(session.id);
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const modelRef = await resolveModel(session, modelIdOverride, effective);
    const chatOpts = modelRef ? { model: modelRef, signal } : signal ? { signal } : undefined;
    let assistantText = '';
    try {
      yield { type: 'status', phase: 'thinking' };
      for await (const token of ai.chat(messages, chatOpts)) {
        assistantText += token;
        yield { type: 'token', token };
        if (signal?.aborted) {
          yield { type: 'aborted' };
          return;
        }
      }
    } catch (err) {
      if (err instanceof AwfError) throw err;
      throw new AwfError('E3002', err instanceof Error ? err.message : 'AI error');
    }
    if (signal?.aborted) {
      yield { type: 'aborted' };
      return;
    }

    const msgId = crypto.randomUUID();
    await repo.appendMessage({
      id: msgId,
      sessionId: session.id,
      role: 'assistant',
      content: assistantText,
      citations,
    });
    yield { type: 'done', messageId: msgId, citations };
  }
}
