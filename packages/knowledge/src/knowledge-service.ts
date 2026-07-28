import type {
  KnowledgeBaseRecord,
  KnowledgeRepository,
  KnowledgeSyncRepository,
  KeywordSearchPort,
  ScoredChunk,
  VectorStorePort,
} from '@rxwf/providers-contracts';
import { AwfError } from '@rxwf/shared';
import { chunkText } from './chunk-text.js';
import type { EmbeddingProvider } from './embedding-provider.js';
import { extractTextFromBuffer } from './parse-document.js';
import { fuseRrf } from './hybrid-fusion.js';
import { createLazyEmbeddingProvider } from './create-embedding-provider.js';
import {
  effectiveEmbeddingModel,
  knowledgeBaseDefaultsFromPlatform,
  type KnowledgePlatformConfig,
} from './platform-config.js';
import { listSyncableFiles, readSyncFile } from './sync-local-dir.js';

export interface KnowledgeIndexJobPayload {
  documentId: string;
  knowledgeBaseId: string;
}

export interface KnowledgeSyncJobPayload {
  syncSourceId: string;
}

export interface KnowledgeServiceDeps {
  repo: KnowledgeRepository;
  vectorStore: VectorStorePort;
  keywordSearch?: KeywordSearchPort;
  syncRepo?: KnowledgeSyncRepository;
  dataDir: string;
  getPlatformConfig: () => Promise<KnowledgePlatformConfig>;
  createEmbeddings?: (model: string) => EmbeddingProvider;
  enqueueIndexJob: (payload: KnowledgeIndexJobPayload) => Promise<void>;
  enqueueSyncJob?: (payload: KnowledgeSyncJobPayload) => Promise<void>;
  readFile: (storagePath: string) => Promise<Buffer>;
  writeFile: (relativePath: string, data: Buffer) => Promise<string>;
  deleteFile?: (relativePath: string) => Promise<void>;
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
}

export function createKnowledgeService(deps: KnowledgeServiceDeps) {
  const embeddingsFor = (model: string): EmbeddingProvider =>
    deps.createEmbeddings?.(model) ??
    createLazyEmbeddingProvider({
      getPlatformConfig: deps.getPlatformConfig,
      model,
      credentialResolver: deps.credentialResolver,
    });

  async function runSearch(
    kb: KnowledgeBaseRecord,
    knowledgeBaseIds: string[],
    queryText: string,
    opts?: { topK?: number; threshold?: number },
  ): Promise<ScoredChunk[]> {
    const topK = opts?.topK ?? kb.topK;
    const threshold = opts?.threshold ?? kb.similarityThreshold;
    const platform = await deps.getPlatformConfig();
    const embeddingModel = effectiveEmbeddingModel(kb, platform);
    const queryEmbedding = await embeddingsFor(embeddingModel).embed(queryText);

    const vectorHits = await deps.vectorStore.search({
      knowledgeBaseIds,
      queryEmbedding,
      topK: topK * 2,
      similarityThreshold: threshold,
    });

    if (!kb.hybridSearchEnabled || !deps.keywordSearch) {
      return vectorHits.slice(0, topK);
    }

    const keywordHits = await deps.keywordSearch.search({
      knowledgeBaseIds,
      query: queryText,
      topK: topK * 2,
    });

    return fuseRrf([vectorHits, keywordHits], topK);
  }

  async function uploadDocument(input: {
    knowledgeBaseId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const kb = await deps.repo.getBase(input.knowledgeBaseId);
    if (!kb) throw new AwfError('E1001', 'Knowledge base not found');

    const docId = crypto.randomUUID();
    const ext = input.fileName.includes('.')
      ? input.fileName.slice(input.fileName.lastIndexOf('.'))
      : '';
    const relativePath = `knowledge/${kb.id}/${docId}${ext}`;
    await deps.writeFile(relativePath, input.buffer);

    const doc = await deps.repo.createDocument({
      id: docId,
      knowledgeBaseId: kb.id,
      name: input.fileName,
      mimeType: input.mimeType || 'application/octet-stream',
      storagePath: relativePath,
      sizeBytes: input.buffer.length,
      status: 'pending',
      errorMessage: null,
      chunkCount: 0,
    });

    await deps.enqueueIndexJob({
      documentId: doc.id,
      knowledgeBaseId: kb.id,
    });
    return doc;
  }

  const api = {
    listBases(opts?: { ids?: string[]; ownerUserId?: string }) {
      return deps.repo.listBases(opts);
    },

    getBase(id: string) {
      return deps.repo.getBase(id);
    },

    async createBase(input: {
      name: string;
      description?: string;
      ownerUserId: string;
      embeddingModel?: string;
      chunkSize?: number;
      chunkOverlap?: number;
      topK?: number;
      similarityThreshold?: number;
      hybridSearchEnabled?: boolean;
    }) {
      const platform = await deps.getPlatformConfig();
      const kbDefaults = knowledgeBaseDefaultsFromPlatform(platform);
      const id = crypto.randomUUID();
      return deps.repo.createBase({
        id,
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        ownerUserId: input.ownerUserId,
        embeddingModel: input.embeddingModel?.trim() || kbDefaults.embeddingModel,
        chunkSize: input.chunkSize ?? kbDefaults.chunkSize,
        chunkOverlap: input.chunkOverlap ?? kbDefaults.chunkOverlap,
        topK: input.topK ?? kbDefaults.topK,
        similarityThreshold: input.similarityThreshold ?? kbDefaults.similarityThreshold,
        hybridSearchEnabled: input.hybridSearchEnabled ?? kbDefaults.hybridSearchEnabled,
      });
    },

    updateBase(
      id: string,
      patch: Parameters<KnowledgeRepository['updateBase']>[1],
    ) {
      return deps.repo.updateBase(id, patch);
    },

    async deleteBase(id: string) {
      const docs = await deps.repo.listDocuments(id);
      for (const doc of docs) {
        if (deps.deleteFile) {
          await deps.deleteFile(doc.storagePath).catch(() => undefined);
        }
        await deps.repo.deleteChunksForDocument(doc.id);
        await deps.repo.deleteDocument(doc.id);
      }
      return deps.repo.deleteBase(id);
    },

    listDocuments(knowledgeBaseId: string) {
      return deps.repo.listDocuments(knowledgeBaseId);
    },

    listChunks(knowledgeBaseId: string, documentId?: string) {
      return deps.repo.listChunks(knowledgeBaseId, { documentId, limit: 200 });
    },

    uploadDocument,

    async reindexDocument(documentId: string) {
      const doc = await deps.repo.getDocument(documentId);
      if (!doc) throw new AwfError('E1001', 'Document not found');
      await deps.repo.updateDocument(documentId, {
        status: 'pending',
        errorMessage: null,
      });
      await deps.enqueueIndexJob({
        documentId: doc.id,
        knowledgeBaseId: doc.knowledgeBaseId,
      });
      return doc;
    },

    async deleteDocument(documentId: string) {
      const doc = await deps.repo.getDocument(documentId);
      if (!doc) return false;
      await deps.repo.deleteChunksForDocument(documentId);
      if (deps.deleteFile) {
        await deps.deleteFile(doc.storagePath).catch(() => undefined);
      }
      return deps.repo.deleteDocument(documentId);
    },

    async indexDocument(payload: KnowledgeIndexJobPayload): Promise<void> {
      const doc = await deps.repo.getDocument(payload.documentId);
      if (!doc) throw new AwfError('E1001', 'Document not found');
      const kb = await deps.repo.getBase(payload.knowledgeBaseId);
      if (!kb) throw new AwfError('E1001', 'Knowledge base not found');

      await deps.repo.updateDocument(doc.id, { status: 'indexing', errorMessage: null });
      try {
        const buffer = await deps.readFile(doc.storagePath);
        const text = await extractTextFromBuffer(buffer, doc.mimeType, doc.name);
        const pieces = chunkText(text, kb.chunkSize, kb.chunkOverlap);
        if (pieces.length === 0) {
          throw new Error('No text extracted from document');
        }

        await deps.repo.deleteChunksForDocument(doc.id);
        const platform = await deps.getPlatformConfig();
        const embeddingModel = effectiveEmbeddingModel(kb, platform);
        const embedder = embeddingsFor(embeddingModel);
        const vectors = await embedder.embedBatch(pieces);
        const rows = pieces.map((piece, i) => ({
          id: crypto.randomUUID(),
          knowledgeBaseId: kb.id,
          documentId: doc.id,
          chunkIndex: i,
          text: piece,
          embedding: vectors[i]!,
          metadata: { documentName: doc.name },
        }));
        await deps.repo.insertChunks(rows);
        await deps.repo.updateDocument(doc.id, {
          status: 'indexed',
          chunkCount: rows.length,
          errorMessage: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await deps.repo.updateDocument(doc.id, {
          status: 'failed',
          errorMessage: message,
        });
        throw err;
      }
    },

    async query(
      knowledgeBaseId: string,
      queryText: string,
      opts?: { topK?: number; threshold?: number },
    ): Promise<ScoredChunk[]> {
      const kb = await deps.repo.getBase(knowledgeBaseId);
      if (!kb) throw new AwfError('E1001', 'Knowledge base not found');
      const hits = await runSearch(kb, [knowledgeBaseId], queryText, opts);
      if (hits.length === 0) {
        throw new AwfError('E3003', 'RAG 未找到相关内容');
      }
      return hits;
    },

    async queryMany(
      knowledgeBaseIds: string[],
      queryText: string,
      opts?: { topK?: number; threshold?: number },
    ): Promise<ScoredChunk[]> {
      if (knowledgeBaseIds.length === 0) {
        throw new AwfError('E3003', 'RAG 未找到相关内容');
      }
      const kb = await deps.repo.getBase(knowledgeBaseIds[0]!);
      if (!kb) throw new AwfError('E1001', 'Knowledge base not found');
      const hits = await runSearch(kb, knowledgeBaseIds, queryText, opts);
      if (hits.length === 0) {
        throw new AwfError('E3003', 'RAG 未找到相关内容');
      }
      return hits;
    },

    async createSyncSource(input: {
      knowledgeBaseId: string;
      kind: 'local_dir';
      path: string;
      enabled?: boolean;
    }) {
      if (!deps.syncRepo) {
        throw new AwfError('E1004', 'Sync repository not configured');
      }
      const id = crypto.randomUUID();
      return deps.syncRepo.createSyncSource({
        id,
        knowledgeBaseId: input.knowledgeBaseId,
        kind: input.kind,
        config: { path: input.path },
        enabled: input.enabled ?? true,
      });
    },

    listSyncSources(knowledgeBaseId: string) {
      if (!deps.syncRepo) return Promise.resolve([]);
      return deps.syncRepo.listSyncSources(knowledgeBaseId);
    },

    async deleteSyncSource(id: string) {
      if (!deps.syncRepo) return false;
      return deps.syncRepo.deleteSyncSource(id);
    },

    async triggerSyncSource(syncSourceId: string) {
      if (!deps.enqueueSyncJob) {
        throw new AwfError('E1004', 'Sync job queue not configured');
      }
      await deps.enqueueSyncJob({ syncSourceId });
    },

    async syncFromSource(syncSourceId: string): Promise<{ uploaded: number }> {
      if (!deps.syncRepo) {
        throw new AwfError('E1004', 'Sync repository not configured');
      }
      const source = await deps.syncRepo.getSyncSource(syncSourceId);
      if (!source) throw new AwfError('E1001', 'Sync source not found');
      if (source.kind !== 'local_dir') {
        throw new AwfError('E1004', `Unsupported sync kind: ${source.kind}`);
      }

      await deps.syncRepo.updateSyncSource(syncSourceId, {
        lastSyncAt: new Date(),
        lastError: null,
      });

      let uploaded = 0;
      try {
        const files = listSyncableFiles(source.config.path);
        for (const file of files) {
          const buffer = readSyncFile(file.absolutePath);
          const mime =
            file.fileName.endsWith('.md')
              ? 'text/markdown'
              : file.fileName.endsWith('.pdf')
                ? 'application/pdf'
                : 'text/plain';
          await uploadDocument({
            knowledgeBaseId: source.knowledgeBaseId,
            fileName: file.fileName,
            mimeType: mime,
            buffer,
          });
          uploaded++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await deps.syncRepo.updateSyncSource(syncSourceId, { lastError: message });
        throw err;
      }

      await deps.syncRepo.updateSyncSource(syncSourceId, {
        lastSyncAt: new Date(),
        lastError: null,
      });
      return { uploaded };
    },
  };

  return api;
}

export type KnowledgeService = ReturnType<typeof createKnowledgeService>;
