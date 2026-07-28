import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_PLATFORM_CONFIG } from './platform-config.js';
import { createLazyEmbeddingProvider, resolveEmbeddingProvider } from './create-embedding-provider.js';

describe('resolveEmbeddingProvider', () => {
  it('uses ollama for ollama provider', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2] }),
    })) as unknown as typeof fetch;

    const provider = await resolveEmbeddingProvider(
      {
        ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
        embedding: {
          provider: 'ollama',
          baseUrl: 'http://ollama.test',
          defaultModel: 'nomic-embed-text',
        },
      },
      'nomic-embed-text',
      { fetchFn },
    );

    await provider.embed('hello');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://ollama.test/api/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when openai-compatible without credential', async () => {
    await expect(
      resolveEmbeddingProvider(
        {
          ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
          embedding: {
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'text-embedding-3-small',
          },
        },
        'text-embedding-3-small',
      ),
    ).rejects.toMatchObject({ code: 'E1004' });
  });
});

describe('createLazyEmbeddingProvider', () => {
  it('reloads platform config on each embed', async () => {
    let baseUrl = 'http://a.test';
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [1] }),
    })) as unknown as typeof fetch;

    const provider = createLazyEmbeddingProvider({
      getPlatformConfig: async () => ({
        ...DEFAULT_KNOWLEDGE_PLATFORM_CONFIG,
        embedding: {
          provider: 'ollama',
          baseUrl,
          defaultModel: 'm',
        },
      }),
      model: 'm',
      fetchFn,
    });

    await provider.embed('x');
    expect(fetchFn).toHaveBeenCalledWith('http://a.test/api/embeddings', expect.anything());

    baseUrl = 'http://b.test';
    await provider.embed('y');
    expect(fetchFn).toHaveBeenLastCalledWith('http://b.test/api/embeddings', expect.anything());
  });
});
