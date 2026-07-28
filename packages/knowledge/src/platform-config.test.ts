import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
  effectiveEmbeddingModel,
  isKnowledgePlatformConfigured,
  parseKnowledgePlatformConfig,
  serializeKnowledgePlatformConfig,
} from './platform-config.js';

describe('parseKnowledgePlatformConfig', () => {
  it('returns defaults for null/undefined/blank', () => {
    for (const raw of [null, undefined, '', '   ']) {
      const cfg = parseKnowledgePlatformConfig(raw);
      expect(cfg.configured).toBe(false);
      expect(cfg.embedding.provider).toBe('ollama');
      expect(cfg.embedding.defaultModel).toBe('nomic-embed-text');
      expect(cfg.rag.defaultModelId).toBe('');
    }
  });

  it('returns defaults for invalid JSON', () => {
    const cfg = parseKnowledgePlatformConfig('{not json');
    expect(cfg.configured).toBe(false);
    expect(cfg.defaults.chunkSize).toBe(1000);
  });

  it('merges partial JSON over defaults', () => {
    const cfg = parseKnowledgePlatformConfig(
      JSON.stringify({
        configured: true,
        embedding: { defaultModel: 'mxbai-embed-large' },
        rag: { defaultModelId: 'm1', defaultTemplate: 'code' },
        defaults: { topK: 8 },
      }),
    );
    expect(cfg.embedding.defaultModel).toBe('mxbai-embed-large');
    expect(cfg.embedding.provider).toBe('ollama');
    expect(cfg.rag.defaultModelId).toBe('m1');
    expect(cfg.rag.defaultTemplate).toBe('code');
    expect(cfg.defaults.topK).toBe(8);
    expect(cfg.defaults.chunkOverlap).toBe(200);
  });

  it('clamps similarityThreshold to 0..1', () => {
    const low = parseKnowledgePlatformConfig(
      JSON.stringify({ defaults: { similarityThreshold: -1 } }),
    );
    expect(low.defaults.similarityThreshold).toBe(0);

    const high = parseKnowledgePlatformConfig(
      JSON.stringify({ defaults: { similarityThreshold: 2 } }),
    );
    expect(high.defaults.similarityThreshold).toBe(1);
  });

  it('round-trips via serialize', () => {
    const input = {
      ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
      configured: true,
      embedding: {
        ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.embedding,
        defaultModel: 'custom-embed',
      },
      rag: {
        ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG.rag,
        defaultModelId: 'model-abc',
      },
    };
    const round = parseKnowledgePlatformConfig(serializeKnowledgePlatformConfig(input));
    expect(round).toEqual(input);
  });
});

describe('isKnowledgePlatformConfigured', () => {
  const base = {
    ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
    configured: true,
    embedding: {
      provider: 'ollama' as const,
      baseUrl: 'http://127.0.0.1:11434',
      defaultModel: 'nomic-embed-text',
    },
    rag: {
      defaultModelId: 'chat-model-1',
      defaultTemplate: 'support' as const,
      fallbackToChat: true,
    },
  };

  it('is false when baseUrl empty', () => {
    expect(
      isKnowledgePlatformConfigured({
        ...base,
        embedding: { ...base.embedding, baseUrl: '' },
      }),
    ).toBe(false);
  });

  it('is false when defaultModel empty', () => {
    expect(
      isKnowledgePlatformConfigured({
        ...base,
        embedding: { ...base.embedding, defaultModel: '  ' },
      }),
    ).toBe(false);
  });

  it('is false when openai-compatible without credentialId', () => {
    expect(
      isKnowledgePlatformConfigured({
        ...base,
        embedding: {
          provider: 'openai-compatible',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'text-embedding-3-small',
        },
      }),
    ).toBe(false);
  });

  it('is true for valid ollama config with rag model id', () => {
    expect(isKnowledgePlatformConfigured(base)).toBe(true);
  });

  it('is false when rag.defaultModelId empty', () => {
    expect(
      isKnowledgePlatformConfigured({
        ...base,
        rag: { ...base.rag, defaultModelId: '' },
      }),
    ).toBe(false);
  });

  it('uses resolveModelRef when provided', async () => {
    const ok = await isKnowledgePlatformConfigured(base, {
      resolveModelRef: async (id) => id === 'chat-model-1',
    });
    expect(ok).toBe(true);

    const bad = await isKnowledgePlatformConfigured(base, {
      resolveModelRef: async () => false,
    });
    expect(bad).toBe(false);
  });
});

describe('effectiveEmbeddingModel', () => {
  const platform = parseKnowledgePlatformConfig(
    JSON.stringify({ embedding: { defaultModel: 'platform-default' } }),
  );

  it('uses platform default when kb model empty', () => {
    expect(effectiveEmbeddingModel({ embeddingModel: '' }, platform)).toBe('platform-default');
    expect(effectiveEmbeddingModel({ embeddingModel: '   ' }, platform)).toBe('platform-default');
  });

  it('uses kb override when set', () => {
    expect(effectiveEmbeddingModel({ embeddingModel: 'kb-model' }, platform)).toBe('kb-model');
  });
});
