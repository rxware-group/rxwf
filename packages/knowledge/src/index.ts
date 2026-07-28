export { chunkText } from './chunk-text.js';
export { cosineSimilarity } from './cosine.js';
export { extractTextFromBuffer, assertDocumentSize } from './parse-document.js';
export { createOllamaEmbeddings } from './ollama-embeddings.js';
export { createOpenAiCompatibleEmbeddings } from './openai-embeddings.js';
export {
  createLazyEmbeddingProvider,
  resolveEmbeddingProvider,
  type EmbeddingProviderFactoryDeps,
} from './create-embedding-provider.js';
export {
  buildRagSystemPrompt,
  chunksToCitations,
  RAG_TEMPLATES,
  type RagTemplateId,
} from './rag-prompts.js';
export { scoreBm25, tokenize } from './bm25.js';
export { fuseRrf } from './hybrid-fusion.js';
export type { EmbeddingProvider } from './embedding-provider.js';
export {
  DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
  effectiveEmbeddingModel,
  embeddingConfigRequiresReindex,
  isKnowledgePlatformConfigured,
  knowledgeBaseDefaultsFromPlatform,
  parseKnowledgePlatformConfig,
  serializeKnowledgePlatformConfig,
  type KnowledgeEmbeddingProvider,
  type KnowledgePlatformConfig,
  type KnowledgeRagTemplate,
} from './platform-config.js';
export {
  createKnowledgeService,
  type KnowledgeService,
  type KnowledgeIndexJobPayload,
  type KnowledgeSyncJobPayload,
  type KnowledgeServiceDeps,
} from './knowledge-service.js';
