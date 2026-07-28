import { AwfError } from '@rxwf/shared';
import type { EmbeddingProvider } from './embedding-provider.js';
import { createOllamaEmbeddings } from './ollama-embeddings.js';
import { createOpenAiCompatibleEmbeddings } from './openai-embeddings.js';
import type { KnowledgePlatformConfig } from './platform-config.js';

export interface EmbeddingProviderFactoryDeps {
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
  fetchFn?: typeof fetch;
}

export async function resolveEmbeddingProvider(
  platform: KnowledgePlatformConfig,
  model: string,
  deps: EmbeddingProviderFactoryDeps = {},
): Promise<EmbeddingProvider> {
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    throw new AwfError('E1004', 'Embedding model is required');
  }

  if (platform.embedding.provider === 'openai-compatible') {
    const credentialId = platform.embedding.credentialId?.trim();
    if (!credentialId) {
      throw new AwfError('E1004', 'Embedding credential is required for openai-compatible');
    }
    if (!deps.credentialResolver) {
      throw new AwfError('E1004', 'Credential resolver is not configured');
    }
    const creds = await deps.credentialResolver(credentialId);
    const apiKey = creds.apiKey ?? creds.accessToken ?? creds.API_KEY ?? '';
    if (!apiKey.trim()) {
      throw new AwfError('E1004', 'Embedding credential must include apiKey');
    }
    return createOpenAiCompatibleEmbeddings({
      baseUrl: platform.embedding.baseUrl,
      model: trimmedModel,
      apiKey: apiKey.trim(),
      fetchFn: deps.fetchFn,
    });
  }

  return createOllamaEmbeddings({
    baseUrl: platform.embedding.baseUrl,
    model: trimmedModel,
    fetchFn: deps.fetchFn,
  });
}

export function createLazyEmbeddingProvider(deps: {
  getPlatformConfig: () => Promise<KnowledgePlatformConfig>;
  model: string;
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
  fetchFn?: typeof fetch;
}): EmbeddingProvider {
  return {
    async embed(text: string) {
      const platform = await deps.getPlatformConfig();
      const provider = await resolveEmbeddingProvider(platform, deps.model, deps);
      return provider.embed(text);
    },
    async embedBatch(texts: string[]) {
      const platform = await deps.getPlatformConfig();
      const provider = await resolveEmbeddingProvider(platform, deps.model, deps);
      return provider.embedBatch(texts);
    },
  };
}
