export type KnowledgeEmbeddingProvider = 'ollama' | 'openai-compatible';
export type KnowledgeRagTemplate = 'support' | 'code';

export interface KnowledgePlatformConfig {
  configured: boolean;
  embedding: {
    provider: KnowledgeEmbeddingProvider;
    baseUrl: string;
    defaultModel: string;
    credentialId?: string;
    dimensions?: number;
  };
  rag: {
    defaultModelId: string;
    defaultTemplate: KnowledgeRagTemplate;
    fallbackToChat: boolean;
  };
  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
    hybridSearchEnabled: boolean;
  };
}

export const DEFAULT_KNOWLEDGE_PLATFORM_CONFIG: KnowledgePlatformConfig = {
  configured: false,
  embedding: {
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'nomic-embed-text',
  },
  rag: {
    defaultModelId: '',
    defaultTemplate: 'support',
    fallbackToChat: true,
  },
  defaults: {
    chunkSize: 1000,
    chunkOverlap: 200,
    topK: 5,
    similarityThreshold: 0.5,
    hybridSearchEnabled: false,
  },
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults.similarityThreshold;
  return Math.min(1, Math.max(0, n));
}

function positiveInt(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.floor(v);
}

function parseProvider(raw: unknown): KnowledgeEmbeddingProvider {
  return raw === 'openai-compatible' ? 'openai-compatible' : 'ollama';
}

function parseRagTemplate(raw: unknown): KnowledgeRagTemplate {
  return raw === 'code' ? 'code' : 'support';
}

export function parseKnowledgePlatformConfig(
  raw: string | null | undefined,
): KnowledgePlatformConfig {
  if (!raw?.trim()) {
    return { ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<KnowledgePlatformConfig>;
    const embedding = (parsed.embedding ?? {}) as Partial<KnowledgePlatformConfig['embedding']>;
    const rag = (parsed.rag ?? {}) as Partial<KnowledgePlatformConfig['rag']>;
    const defaults = (parsed.defaults ?? {}) as Partial<KnowledgePlatformConfig['defaults']>;
    return {
      configured: parsed.configured === true,
      embedding: {
        provider: parseProvider(embedding.provider),
        baseUrl:
          typeof embedding.baseUrl === 'string'
            ? embedding.baseUrl.trim()
            : DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.embedding.baseUrl,
        defaultModel:
          typeof embedding.defaultModel === 'string'
            ? embedding.defaultModel.trim()
            : DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.embedding.defaultModel,
        credentialId:
          typeof embedding.credentialId === 'string'
            ? embedding.credentialId.trim() || undefined
            : undefined,
        dimensions:
          typeof embedding.dimensions === 'number' && embedding.dimensions > 0
            ? Math.floor(embedding.dimensions)
            : undefined,
      },
      rag: {
        defaultModelId:
          typeof rag.defaultModelId === 'string' ? rag.defaultModelId.trim() : '',
        defaultTemplate: parseRagTemplate(rag.defaultTemplate),
        fallbackToChat: rag.fallbackToChat !== false,
      },
      defaults: {
        chunkSize: positiveInt(defaults.chunkSize, DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults.chunkSize),
        chunkOverlap: positiveInt(
          defaults.chunkOverlap,
          DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults.chunkOverlap,
        ),
        topK: positiveInt(defaults.topK, DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults.topK),
        similarityThreshold: clamp01(
          typeof defaults.similarityThreshold === 'number'
            ? defaults.similarityThreshold
            : DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.defaults.similarityThreshold,
        ),
        hybridSearchEnabled: defaults.hybridSearchEnabled === true,
      },
    };
  } catch {
    return { ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG };
  }
}

export function serializeKnowledgePlatformConfig(config: KnowledgePlatformConfig): string {
  return JSON.stringify(config);
}

export function isKnowledgePlatformConfigured(
  config: KnowledgePlatformConfig,
  opts?: {
    resolveModelRef?: (modelId: string) => boolean | Promise<boolean>;
  },
): boolean | Promise<boolean> {
  const { embedding, rag } = config;
  if (!embedding.baseUrl.trim()) return false;
  if (!embedding.defaultModel.trim()) return false;
  if (embedding.provider === 'openai-compatible' && !embedding.credentialId?.trim()) {
    return false;
  }
  if (!rag.defaultModelId.trim()) return false;

  if (opts?.resolveModelRef) {
    return Promise.resolve(opts.resolveModelRef(rag.defaultModelId));
  }
  return true;
}

export function effectiveEmbeddingModel(
  kb: { embeddingModel: string },
  platform: KnowledgePlatformConfig,
): string {
  const override = kb.embeddingModel?.trim();
  if (override) return override;
  return platform.embedding.defaultModel.trim();
}

/** Fields from platform defaults applied when creating a knowledge base. */
export function knowledgeBaseDefaultsFromPlatform(
  platform: KnowledgePlatformConfig,
): Pick<
  KnowledgePlatformConfig['defaults'],
  'chunkSize' | 'chunkOverlap' | 'topK' | 'similarityThreshold' | 'hybridSearchEnabled'
> & { embeddingModel: string } {
  return {
    embeddingModel: platform.embedding.defaultModel,
    chunkSize: platform.defaults.chunkSize,
    chunkOverlap: platform.defaults.chunkOverlap,
    topK: platform.defaults.topK,
    similarityThreshold: platform.defaults.similarityThreshold,
    hybridSearchEnabled: platform.defaults.hybridSearchEnabled,
  };
}

const EMBEDDING_REINDEX_KEYS = [
  'provider',
  'baseUrl',
  'credentialId',
  'defaultModel',
] as const;

export function embeddingConfigRequiresReindex(
  prev: KnowledgePlatformConfig,
  next: KnowledgePlatformConfig,
): boolean {
  for (const key of EMBEDDING_REINDEX_KEYS) {
    const a = prev.embedding[key] ?? '';
    const b = next.embedding[key] ?? '';
    if (String(a) !== String(b)) return true;
  }
  return false;
}
