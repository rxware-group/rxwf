export type ModelProviderKind = 'ollama' | 'openai-compatible';
export type ModelHealthStatus = 'ok' | 'error' | 'unknown';

export interface ModelProviderRecord {
  id: string;
  name: string;
  kind: ModelProviderKind;
  baseUrl: string;
  credentialId: string | null;
  enabled: boolean;
  healthStatus: ModelHealthStatus;
  lastHealthAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  modelName: string;
  capabilities: string[];
  isDefaultChat: boolean;
  isDefaultWorkflow: boolean;
  enabled: boolean;
  source: 'manual' | 'discovered';
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelCatalogRepository {
  listProviders(): Promise<ModelProviderRecord[]>;
  createProvider(input: Omit<ModelProviderRecord, 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthAt'>): Promise<ModelProviderRecord>;
  updateProvider(
    id: string,
    patch: Partial<
      Pick<ModelProviderRecord, 'name' | 'kind' | 'baseUrl' | 'credentialId' | 'enabled'>
    >,
  ): Promise<ModelProviderRecord | null>;
  updateProviderHealth(
    id: string,
    healthStatus: ModelHealthStatus,
  ): Promise<ModelProviderRecord | null>;
  listModels(filter?: { capability?: string }): Promise<ModelRecord[]>;
  findModelById(id: string): Promise<ModelRecord | null>;
  findProviderById(id: string): Promise<ModelProviderRecord | null>;
  addModel(input: Omit<ModelRecord, 'createdAt' | 'updatedAt'>): Promise<ModelRecord>;
  updateModel(
    id: string,
    patch: Partial<Pick<ModelRecord, 'enabled' | 'isDefaultChat' | 'isDefaultWorkflow'>>,
  ): Promise<ModelRecord | null>;
  upsertDiscoveredModels(providerId: string, models: Array<{ modelName: string; capabilities: string[] }>): Promise<void>;
  setDefaultChatModel(modelId: string): Promise<void>;
  setDefaultWorkflowModel(modelId: string): Promise<void>;
}
