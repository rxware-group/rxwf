export type EnvScope = 'global' | 'user' | 'workflow';
export type EnvEnvironment = 'test' | 'prod' | 'runtime';

export interface EnvVarRecord {
  id: string;
  scope: EnvScope;
  scopeId: string | null;
  environment: EnvEnvironment;
  key: string;
  value: string;
  sensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvUpsertInput {
  scope: EnvScope;
  scopeId?: string | null;
  environment: EnvEnvironment;
  key: string;
  value: string;
  sensitive?: boolean;
}

export interface GlobalEnvVarItem {
  key: string;
  sensitive: boolean;
  value: string;
  testEnabled: boolean;
  prodEnabled: boolean;
  testId?: string;
  prodId?: string;
}

export interface GlobalEnvSyncInput {
  key: string;
  value: string;
  sensitive?: boolean;
  testEnabled: boolean;
  prodEnabled: boolean;
}

export interface PlatformEnvUpsertInput {
  key: string;
  value: string;
  sensitive: boolean;
}

export interface EnvRepositoryPort {
  list(filter: {
    scope: EnvScope;
    scopeId?: string | null;
    environment: EnvEnvironment;
  }): Promise<EnvVarRecord[]>;
  listAllGlobal(): Promise<EnvVarRecord[]>;
  listGlobalForKey(key: string): Promise<EnvVarRecord[]>;
  listPlatformEnvForKey(key: string): Promise<EnvVarRecord | null>;
  upsertPlatformEnv(input: PlatformEnvUpsertInput): Promise<EnvVarRecord>;
  syncGlobalItem(input: GlobalEnvSyncInput): Promise<void>;
  upsertMany(items: EnvUpsertInput[]): Promise<EnvVarRecord[]>;
  deleteById(id: string): Promise<void>;
  loadLayers(input: {
    workflowId?: string;
    userId?: string;
    environment: EnvEnvironment;
  }): Promise<{
    global: Record<string, string>;
    user: Record<string, string>;
    workflow: Record<string, string>;
  }>;
}
