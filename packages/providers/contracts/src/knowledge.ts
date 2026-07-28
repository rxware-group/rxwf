export type KnowledgeDocumentStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface KnowledgeBaseRecord {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  hybridSearchEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeSyncKind = 'local_dir';

export interface KnowledgeSyncSourceRecord {
  id: string;
  knowledgeBaseId: string;
  kind: KnowledgeSyncKind;
  config: { path: string };
  enabled: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeDocumentRecord {
  id: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunkRecord {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface ScoredChunk {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeRepository {
  createBase(input: Omit<KnowledgeBaseRecord, 'createdAt' | 'updatedAt'>): Promise<KnowledgeBaseRecord>;
  updateBase(
    id: string,
    patch: Partial<
      Pick<
        KnowledgeBaseRecord,
        | 'name'
        | 'description'
        | 'embeddingModel'
        | 'chunkSize'
        | 'chunkOverlap'
        | 'topK'
        | 'similarityThreshold'
        | 'hybridSearchEnabled'
      >
    >,
  ): Promise<KnowledgeBaseRecord | null>;
  deleteBase(id: string): Promise<boolean>;
  getBase(id: string): Promise<KnowledgeBaseRecord | null>;
  listBases(opts?: {
    ids?: string[];
    ownerUserId?: string;
  }): Promise<KnowledgeBaseRecord[]>;

  createDocument(
    input: Omit<KnowledgeDocumentRecord, 'createdAt' | 'updatedAt' | 'chunkCount' | 'errorMessage'> & {
      errorMessage?: string | null;
      chunkCount?: number;
    },
  ): Promise<KnowledgeDocumentRecord>;
  updateDocument(
    id: string,
    patch: Partial<
      Pick<
        KnowledgeDocumentRecord,
        'status' | 'errorMessage' | 'chunkCount' | 'name' | 'storagePath' | 'sizeBytes'
      >
    >,
  ): Promise<KnowledgeDocumentRecord | null>;
  deleteDocument(id: string): Promise<boolean>;
  getDocument(id: string): Promise<KnowledgeDocumentRecord | null>;
  listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocumentRecord[]>;

  deleteChunksForDocument(documentId: string): Promise<void>;
  insertChunks(
    rows: Array<{
      id: string;
      knowledgeBaseId: string;
      documentId: string;
      chunkIndex: number;
      text: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void>;
  listChunks(
    knowledgeBaseId: string,
    opts?: { documentId?: string; limit?: number },
  ): Promise<KnowledgeChunkRecord[]>;
}

export interface VectorSearchOptions {
  knowledgeBaseIds: string[];
  queryEmbedding: number[];
  topK: number;
  similarityThreshold: number;
}

export interface VectorStorePort {
  search(opts: VectorSearchOptions): Promise<ScoredChunk[]>;
}

export interface KeywordSearchOptions {
  knowledgeBaseIds: string[];
  query: string;
  topK: number;
}

export interface KeywordSearchPort {
  search(opts: KeywordSearchOptions): Promise<ScoredChunk[]>;
}

export interface KnowledgeSyncRepository {
  createSyncSource(
    input: Omit<KnowledgeSyncSourceRecord, 'createdAt' | 'updatedAt' | 'lastSyncAt' | 'lastError'> & {
      lastSyncAt?: Date | null;
      lastError?: string | null;
    },
  ): Promise<KnowledgeSyncSourceRecord>;
  updateSyncSource(
    id: string,
    patch: Partial<Pick<KnowledgeSyncSourceRecord, 'enabled' | 'config' | 'lastSyncAt' | 'lastError'>>,
  ): Promise<KnowledgeSyncSourceRecord | null>;
  deleteSyncSource(id: string): Promise<boolean>;
  getSyncSource(id: string): Promise<KnowledgeSyncSourceRecord | null>;
  listSyncSources(knowledgeBaseId: string): Promise<KnowledgeSyncSourceRecord[]>;
  listEnabledSyncSources(): Promise<KnowledgeSyncSourceRecord[]>;
}
