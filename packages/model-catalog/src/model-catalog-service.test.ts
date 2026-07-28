import { describe, it, expect, vi } from 'vitest';
import type {
  ModelCatalogRepository,
  ModelProviderRecord,
  ModelRecord,
} from './types.js';
import { createModelCatalogService } from './model-catalog-service.js';

function createMemoryRepo(
  overrides: Partial<ModelCatalogRepository> = {},
): ModelCatalogRepository {
  const providers: ModelProviderRecord[] = [];
  const models: ModelRecord[] = [];
  const now = new Date();

  return {
    async listProviders() {
      return providers;
    },
    async createProvider(input) {
      const row: ModelProviderRecord = {
        ...input,
        healthStatus: 'unknown',
        lastHealthAt: null,
        createdAt: now,
        updatedAt: now,
      };
      providers.push(row);
      return row;
    },
    async listModels(filter) {
      if (!filter?.capability) return models;
      return models.filter((m) => m.capabilities.includes(filter.capability!));
    },
    async findModelById(id) {
      return models.find((m) => m.id === id) ?? null;
    },
    async findProviderById(id) {
      return providers.find((p) => p.id === id) ?? null;
    },
    async upsertDiscoveredModels(providerId, discovered) {
      for (const item of discovered) {
        const existing = models.find(
          (m) => m.providerId === providerId && m.modelName === item.modelName,
        );
        if (existing) {
          existing.capabilities = item.capabilities;
          existing.updatedAt = now;
          continue;
        }
        models.push({
          id: crypto.randomUUID(),
          providerId,
          modelName: item.modelName,
          capabilities: item.capabilities,
          isDefaultChat: false,
          isDefaultWorkflow: false,
          enabled: true,
          source: 'discovered',
          createdAt: now,
          updatedAt: now,
        });
      }
    },
    async setDefaultChatModel(modelId) {
      for (const m of models) {
        m.isDefaultChat = m.id === modelId;
      }
    },
    async setDefaultWorkflowModel(modelId) {
      for (const m of models) {
        m.isDefaultWorkflow = m.id === modelId;
      }
    },
    async updateProvider(id, patch) {
      const provider = providers.find((p) => p.id === id);
      if (!provider) return null;
      Object.assign(provider, patch, { updatedAt: now });
      return provider;
    },
    async updateProviderHealth(id, healthStatus) {
      const provider = providers.find((p) => p.id === id);
      if (!provider) return null;
      provider.healthStatus = healthStatus;
      provider.lastHealthAt = now;
      provider.updatedAt = now;
      return provider;
    },
    async addModel(input) {
      const row: ModelRecord = { ...input, createdAt: now, updatedAt: now };
      models.push(row);
      return row;
    },
    async updateModel(id, patch) {
      const model = models.find((m) => m.id === id);
      if (!model) return null;
      Object.assign(model, patch, { updatedAt: now });
      return model;
    },
    ...overrides,
  };
}

describe('createModelCatalogService', () => {
  it('resolveModelRef returns correct ref for enabled model', async () => {
    const repo = createMemoryRepo();
    await repo.createProvider({
      id: 'p1',
      name: 'Ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      credentialId: null,
      enabled: true,
    });
    const upsert = repo.upsertDiscoveredModels.bind(repo);
    await upsert('p1', [{ modelName: 'llama3', capabilities: ['chat'] }]);
    const models = await repo.listModels();
    const model = models[0];
    expect(model).toBeDefined();
    const service = createModelCatalogService({ repo });

    const ref = await service.resolveModelRef(model!.id);

    expect(ref).toEqual({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: 'http://127.0.0.1:11434',
    });
  });

  it('resolveModelRef throws E3001 when model disabled', async () => {
    const repo = createMemoryRepo();
    await repo.createProvider({
      id: 'p1',
      name: 'Ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      credentialId: null,
      enabled: true,
    });
    const upsert = repo.upsertDiscoveredModels.bind(repo);
    await upsert('p1', [{ modelName: 'llama3', capabilities: ['chat'] }]);
    const models = await repo.listModels();
    const model = models[0];
    expect(model).toBeDefined();
    model!.enabled = false;
    const service = createModelCatalogService({ repo });

    await expect(service.resolveModelRef(model!.id)).rejects.toMatchObject({
      code: 'E3001',
    });
  });

  it('resolveWorkflowDefaultOllama returns provider url and model name', async () => {
    const repo = createMemoryRepo();
    await repo.createProvider({
      id: 'p1',
      name: 'Ollama',
      kind: 'ollama',
      baseUrl: 'http://192.168.1.10:11434',
      credentialId: null,
      enabled: true,
    });
    await repo.addModel({
      id: 'm1',
      providerId: 'p1',
      modelName: 'qwen3:8b',
      capabilities: ['chat'],
      isDefaultChat: false,
      isDefaultWorkflow: true,
      enabled: true,
      source: 'manual',
    });
    const service = createModelCatalogService({ repo });
    await expect(service.resolveWorkflowDefaultOllama()).resolves.toEqual({
      ollamaUrl: 'http://192.168.1.10:11434',
      ollamaModel: 'qwen3:8b',
    });
  });

  it('syncOllama calls fetch and upserts discovered models', async () => {
    const upsertDiscoveredModels = vi.fn().mockResolvedValue(undefined);
    const repo = createMemoryRepo({ upsertDiscoveredModels });
    await repo.createProvider({
      id: 'p1',
      name: 'Ollama',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      credentialId: null,
      enabled: true,
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3' }, { name: 'mistral' }],
      }),
    });
    const service = createModelCatalogService({ repo, fetchFn });

    await service.syncOllama('p1');

    expect(fetchFn).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags');
    expect(upsertDiscoveredModels).toHaveBeenCalledWith('p1', [
      { modelName: 'llama3', capabilities: ['chat'] },
      { modelName: 'mistral', capabilities: ['chat'] },
    ]);
  });
});
