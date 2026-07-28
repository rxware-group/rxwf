/**
 * M2 AC-19: RAG stream returns citations when knowledge hits exist
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { EmbeddingProvider } from '@rxwf/knowledge';
import { createTestDb, liteSchema } from '@rxwf/providers-lite';
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

describe('chat RAG citations (AC-19)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let apiKey: string;
  let kbId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      seedKnowledgePlatformConfig: true,
      createEmbeddings: () => mockEmbeddings(),
      aiRuntime: {
        async *chat() {
          yield 'answer-with-citations';
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
      email: 'chat-rag-cit@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'rag-cit')).key;

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { 'x-api-key': apiKey },
      payload: { name: 'Citation KB', similarityThreshold: 0.1 },
    });
    expect(kbRes.statusCode).toBe(201);
    kbId = (kbRes.json() as { id: string }).id;

    const docId = crypto.randomUUID();
    const chunkId = crypto.randomUUID();
    const now = new Date();
    await db.insert(liteSchema.knowledgeDocuments).values({
      id: docId,
      knowledgeBaseId: kbId,
      name: 'doc.txt',
      mimeType: 'text/plain',
      storagePath: 'test/doc.txt',
      sizeBytes: 100,
      status: 'indexed',
      chunkCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(liteSchema.knowledgeChunks).values({
      id: chunkId,
      knowledgeBaseId: kbId,
      documentId: docId,
      chunkIndex: 0,
      text: 'RX-Workflow helps you automate tasks with visual workflows.',
      embeddingJson: JSON.stringify(MOCK_VEC),
      metadataJson: '{}',
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('returns citations in SSE done event when RAG hits chunks', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: {
        title: 'RAG Citations',
        mode: 'rag',
        knowledgeBaseIds: [kbId],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json() as { id: string };

    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers: headers(),
      payload: { content: 'What is RX-Workflow?', mode: 'rag', fallbackToChat: false },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('answer-with-citations');
    expect(streamRes.body).toContain('"citations"');
    expect(streamRes.body).toContain('doc.txt');
    expect(streamRes.body).toContain('[DONE]');
  });

  it('uses platform RAG default model when session has no modelId (AC-K7)', async () => {
    let capturedModel: string | undefined;
    const db2 = await createTestDb();
    const built = await buildApp({
      db: db2,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      seedKnowledgePlatformConfig: true,
      createEmbeddings: () => mockEmbeddings(),
      aiRuntime: {
        async *chat(_messages, opts) {
          capturedModel = opts?.model?.model;
          yield 'platform-model-answer';
        },
        async runAgent() {
          return { items: [] };
        },
      },
    });
    const users = createUserService(db2);
    const auth = createAuthService(db2);
    const user = await users.createUser({
      email: 'chat-rag-platform@example.com',
      password: 'secret',
      role: 'admin',
    });
    const key = (await auth.createApiKey(user.id, 'rag-platform')).key;
    const hdrs = { 'x-api-key': key };

    const kbRes = await built.app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: hdrs,
      payload: { name: 'Platform Model KB', similarityThreshold: 0.1 },
    });
    expect(kbRes.statusCode).toBe(201);
    const kb = (kbRes.json() as { id: string }).id;

    const docId = crypto.randomUUID();
    const chunkId = crypto.randomUUID();
    const now = new Date();
    await db2.insert(liteSchema.knowledgeDocuments).values({
      id: docId,
      knowledgeBaseId: kb,
      name: 'seed.txt',
      mimeType: 'text/plain',
      storagePath: 'test/seed.txt',
      sizeBytes: 50,
      status: 'indexed',
      chunkCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db2.insert(liteSchema.knowledgeChunks).values({
      id: chunkId,
      knowledgeBaseId: kb,
      documentId: docId,
      chunkIndex: 0,
      text: 'Platform default model drives RAG answers.',
      embeddingJson: JSON.stringify(MOCK_VEC),
      metadataJson: '{}',
    });

    await built.app.ready();

    const createRes = await built.app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: hdrs,
      payload: {
        title: 'No modelId',
        mode: 'rag',
        knowledgeBaseIds: [kb],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json() as { id: string; modelId: string | null };
    expect(session.modelId).toBeFalsy();

    const streamRes = await built.app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers: hdrs,
      payload: { content: 'What drives RAG?', mode: 'rag', fallbackToChat: false },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('platform-model-answer');
    expect(capturedModel).toBe('llama3');

    await built.app.close();
  });
});
