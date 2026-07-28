import {
  createKnowledgeService,
  type EmbeddingProvider,
  type KnowledgeIndexJobPayload,
  type KnowledgeService,
  type KnowledgePlatformConfig,
  type KnowledgeSyncJobPayload,
} from '@rxwf/knowledge';
import type { JobHandler } from '@rxwf/execution';
import {
  createLiteKnowledgeJobEnqueue,
  createLiteKnowledgeRepository,
  createLiteKeywordSearch,
  createLiteKnowledgeSyncRepository,
  createLiteVectorStore,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import {
  createBullMQKnowledgeQueue,
  type BullMQKnowledgeQueueHandle,
  createPgVectorStore,
  createPgKeywordSearch,
  createStandardKnowledgeRepository,
  createStandardKnowledgeSyncRepository,
  type PgPool,
  type StandardDatabase,
} from '@rxwf/providers-standard';
import { createKnowledgeFileStorage } from './file-storage.js';

export interface KnowledgeRuntime {
  service: KnowledgeService;
  jobHandlers: JobHandler[];
  stopWorkers?: () => Promise<void>;
  getPlatformConfig: () => Promise<KnowledgePlatformConfig>;
}

export async function createKnowledgeRuntime(input: {
  profile: 'lite' | 'standard';
  liteDb: LiteDatabase;
  pgPool?: PgPool;
  pgDb?: StandardDatabase;
  dataDir: string;
  getPlatformConfig: () => Promise<KnowledgePlatformConfig>;
  redisUrl?: string;
  bullmqConcurrency?: number;
  createEmbeddings?: (model: string) => EmbeddingProvider;
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
}): Promise<KnowledgeRuntime> {
  const usePg = input.profile === 'standard' && input.pgPool && input.pgDb;
  const repo = usePg
    ? createStandardKnowledgeRepository(input.pgDb!, input.pgPool!)
    : createLiteKnowledgeRepository(input.liteDb);
  const vectorStore = usePg
    ? createPgVectorStore(input.pgPool!)
    : createLiteVectorStore(input.liteDb);
  const keywordSearch = usePg
    ? createPgKeywordSearch(input.pgPool!)
    : createLiteKeywordSearch(input.liteDb);
  const syncRepo = usePg
    ? createStandardKnowledgeSyncRepository(input.pgDb!)
    : createLiteKnowledgeSyncRepository(input.liteDb);

  const liteEnqueue = createLiteKnowledgeJobEnqueue(input.liteDb);
  let enqueueIndexJob: (p: KnowledgeIndexJobPayload) => Promise<void> =
    liteEnqueue.enqueueKnowledgeIndex;
  let enqueueSyncJob: (p: KnowledgeSyncJobPayload) => Promise<void> =
    liteEnqueue.enqueueKnowledgeSync;
  let bullQueue: BullMQKnowledgeQueueHandle | undefined;

  if (input.profile === 'standard' && input.redisUrl) {
    bullQueue = createBullMQKnowledgeQueue({
      redisUrl: input.redisUrl,
      concurrency: input.bullmqConcurrency,
    });
    enqueueIndexJob = (p) => bullQueue!.enqueueIndexJob(p);
    enqueueSyncJob = (p) => bullQueue!.enqueueSyncJob(p);
  }

  const files = createKnowledgeFileStorage(input.dataDir);
  const getPlatformConfig = input.getPlatformConfig;

  const service = createKnowledgeService({
    repo,
    vectorStore,
    keywordSearch,
    syncRepo,
    dataDir: input.dataDir,
    getPlatformConfig,
    createEmbeddings: input.createEmbeddings,
    credentialResolver: input.credentialResolver,
    enqueueIndexJob,
    enqueueSyncJob,
    readFile: (path) => files.readFile(path),
    writeFile: (path, data) => files.writeFile(path, data),
    deleteFile: (path) => files.deleteFile(path),
  });

  let stopWorkers: (() => Promise<void>) | undefined;
  if (bullQueue) {
    stopWorkers = await bullQueue.startWorker({
      indexDocument: (p) => service.indexDocument(p),
      syncFromSource: async (p) => {
        await service.syncFromSource(p.syncSourceId);
      },
    });
  }

  const jobHandlers: JobHandler[] = [
    {
      kind: 'knowledge.index',
      handle: async (payload) => {
        await service.indexDocument(JSON.parse(payload) as KnowledgeIndexJobPayload);
      },
    },
    {
      kind: 'knowledge.sync',
      handle: async (payload) => {
        const { syncSourceId } = JSON.parse(payload) as KnowledgeSyncJobPayload;
        await service.syncFromSource(syncSourceId);
      },
    },
  ];

  return { service, jobHandlers, stopWorkers, getPlatformConfig };
}
