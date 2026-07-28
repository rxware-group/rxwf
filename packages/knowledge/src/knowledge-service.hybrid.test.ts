import { describe, expect, it, vi } from 'vitest';
import { createKnowledgeService } from './knowledge-service.js';

describe('createKnowledgeService hybrid search', () => {
  it('fuses vector and keyword hits when hybrid enabled', async () => {
    const embed = vi.fn().mockResolvedValue([1, 0]);
    const service = createKnowledgeService({
      repo: {
        listBases: async () => [],
        getBase: async () => ({
          id: 'kb1',
          name: 'KB',
          description: '',
          ownerUserId: 'u1',
          embeddingModel: 'test',
          chunkSize: 100,
          chunkOverlap: 20,
          topK: 2,
          similarityThreshold: 0,
          hybridSearchEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        createBase: async () => {
          throw new Error('unused');
        },
        updateBase: async () => null,
        deleteBase: async () => false,
        listDocuments: async () => [],
        getDocument: async () => null,
        createDocument: async () => {
          throw new Error('unused');
        },
        updateDocument: async () => null,
        deleteDocument: async () => false,
        listChunks: async () => [],
        insertChunks: async () => {},
        deleteChunksForDocument: async () => {},
      },
      vectorStore: {
        search: async () => [
          {
            id: 'v1',
            knowledgeBaseId: 'kb1',
            documentId: 'd1',
            documentName: 'a.md',
            chunkIndex: 0,
            text: 'vector hit',
            score: 0.9,
            metadata: {},
          },
        ],
      },
      keywordSearch: {
        search: async () => [
          {
            id: 'k1',
            knowledgeBaseId: 'kb1',
            documentId: 'd2',
            documentName: 'b.md',
            chunkIndex: 0,
            text: 'keyword hit',
            score: 0.8,
            metadata: {},
          },
        ],
      },
      dataDir: '/tmp',
      getPlatformConfig: async () => ({
        configured: true,
        embedding: {
          provider: 'ollama',
          baseUrl: 'http://localhost:11434',
          defaultModel: 'test',
        },
        rag: {
          defaultModelId: 'm1',
          defaultTemplate: 'support',
          fallbackToChat: true,
        },
        defaults: {
          chunkSize: 100,
          chunkOverlap: 20,
          topK: 2,
          similarityThreshold: 0,
          hybridSearchEnabled: false,
        },
      }),
      createEmbeddings: () => ({ embed, embedBatch: async (t: string[]) => t.map(() => [1, 0]) }),
      enqueueIndexJob: async () => {},
      readFile: async () => Buffer.from(''),
      writeFile: async () => 'path',
    });

    const hits = await service.query('kb1', 'test question');
    expect(hits.length).toBeGreaterThan(0);
    expect(embed).toHaveBeenCalled();
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('v1');
    expect(ids).toContain('k1');
  });
});
