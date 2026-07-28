/**
 * M2 AC-19: RAG stream with fallback when no chunks match
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { EmbeddingProvider } from '@rxwf/knowledge';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';

const MOCK_DIM = 8;
const MOCK_VEC = Array.from({ length: MOCK_DIM }, (_, i) => (i === 0 ? 1 : 0));

function mockEmbeddings(): EmbeddingProvider {
  return {
    async embed() {
      return [...MOCK_VEC];
    },
    async embedBatch(texts: string[]) {
      return texts.map(() => [...MOCK_VEC]);
    },
  };
}

describe('chat RAG integration (AC-19)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;
  let kbId: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      seedKnowledgePlatformConfig: true,
      createEmbeddings: () => mockEmbeddings(),
      aiRuntime: {
        async *chat() {
          yield 'rag-fallback-reply';
        },
        async runAgent() {
          return { items: [] };
        },
      },
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'chat-rag@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'chat-rag')).key;

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'RAG Test KB' },
    });
    expect(kbRes.statusCode).toBe(201);
    kbId = (kbRes.json() as { id: string }).id;

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('falls back to plain chat when RAG has no hits (AC-19)', async () => {
    // knowledge.queryMany throws E3003 on empty hits; fallback path uses mocked ai.chat
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: {
        title: 'RAG Session',
        mode: 'rag',
        knowledgeBaseIds: [kbId],
        ragTemplate: 'support',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json() as { id: string };

    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers: headers(),
      payload: { content: 'what is rxwf?', mode: 'rag', fallbackToChat: true },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('rag-fallback-reply');
    expect(streamRes.body).not.toContain('"citations":[');
    expect(streamRes.body).toContain('[DONE]');
  });
});
