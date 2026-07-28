import type { ModelRef } from '@rxwf/ai-runtime-stub';
import { AwfError } from '@rxwf/shared';
import type {
  ModelCatalogRepository,
  ModelHealthStatus,
  ModelProviderRecord,
  ModelRecord,
} from './types.js';
import { fetchOllamaTags } from './ollama-sync.js';

export function createModelCatalogService(deps: {
  repo: ModelCatalogRepository;
  fetchFn?: typeof fetch;
}) {
  const { repo, fetchFn = fetch } = deps;

  return {
    listProviders() {
      return repo.listProviders();
    },

    createProvider(
      input: Omit<ModelProviderRecord, 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthAt'>,
    ) {
      return repo.createProvider(input);
    },

    updateProvider(
      id: string,
      patch: Partial<Pick<ModelProviderRecord, 'name' | 'kind' | 'baseUrl' | 'credentialId' | 'enabled'>>,
    ) {
      return repo.updateProvider(id, patch);
    },

    disableProvider(id: string) {
      return repo.updateProvider(id, { enabled: false });
    },

    listModels(filter?: { capability?: string }) {
      return repo.listModels(filter);
    },

    addModel(input: Omit<ModelRecord, 'createdAt' | 'updatedAt'>) {
      return repo.addModel(input);
    },

    async updateModel(
      id: string,
      patch: Partial<Pick<ModelRecord, 'enabled' | 'isDefaultChat' | 'isDefaultWorkflow'>>,
    ) {
      if (patch.isDefaultChat) {
        await repo.setDefaultChatModel(id);
      }
      if (patch.isDefaultWorkflow) {
        await repo.setDefaultWorkflowModel(id);
      }
      return repo.updateModel(id, patch);
    },

    async healthCheckProvider(providerId: string) {
      const provider = await repo.findProviderById(providerId);
      if (!provider) {
        throw new AwfError('E3001', 'Model provider not found');
      }
      let healthStatus: ModelHealthStatus = 'error';
      try {
        const res = await fetchFn(`${provider.baseUrl.replace(/\/$/, '')}/api/tags`);
        healthStatus = res.ok ? 'ok' : 'error';
      } catch {
        healthStatus = 'error';
      }
      const updated = await repo.updateProviderHealth(providerId, healthStatus);
      if (!updated) {
        throw new AwfError('E3001', 'Model provider not found');
      }
      return updated;
    },

    async syncOllama(providerId: string) {
      const provider = await repo.findProviderById(providerId);
      if (!provider || provider.kind !== 'ollama') {
        throw new AwfError('E3001', 'Ollama provider not found');
      }
      const discovered = await fetchOllamaTags(provider.baseUrl, fetchFn);
      await repo.upsertDiscoveredModels(providerId, discovered);
    },

    async resolveModelRef(modelId: string): Promise<ModelRef> {
      const model = await repo.findModelById(modelId);
      if (!model || !model.enabled) {
        throw new AwfError('E3001', 'Model not available');
      }
      const provider = await repo.findProviderById(model.providerId);
      if (!provider || !provider.enabled) {
        throw new AwfError('E3001', 'Model provider not available');
      }
      return {
        provider: provider.kind,
        model: model.modelName,
        baseUrl: provider.baseUrl,
        ...(provider.credentialId
          ? { credentialId: provider.credentialId }
          : {}),
      };
    },

    async resolveWorkflowDefaultOllama(): Promise<{ ollamaUrl: string; ollamaModel: string } | null> {
      const allModels = await repo.listModels();
      const workflowDefault = allModels.find((m) => m.enabled && m.isDefaultWorkflow);
      if (!workflowDefault) return null;
      const provider = await repo.findProviderById(workflowDefault.providerId);
      if (!provider?.enabled || provider.kind !== 'ollama') return null;
      return {
        ollamaUrl: provider.baseUrl,
        ollamaModel: workflowDefault.modelName,
      };
    },
  };
}
