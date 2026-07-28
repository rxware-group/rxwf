export type VarScope = 'global' | 'user' | 'workflow';
export type VarEnvironment = 'test' | 'prod';

export interface VarRecord {
  id: string;
  scope: VarScope;
  scopeId: string | null;
  environment: VarEnvironment;
  key: string;
  value: string;
  sensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VarUpsertInput {
  scope: VarScope;
  scopeId?: string | null;
  environment: VarEnvironment;
  key: string;
  value: string;
  sensitive?: boolean;
}

export interface GlobalVarItem {
  key: string;
  sensitive: boolean;
  value: string;
  testEnabled: boolean;
  prodEnabled: boolean;
  testId?: string;
  prodId?: string;
}

export interface GlobalVarSyncInput {
  key: string;
  value: string;
  sensitive?: boolean;
  testEnabled: boolean;
  prodEnabled: boolean;
}

export interface VariablesRepositoryPort {
  list(filter: {
    scope: VarScope;
    scopeId?: string | null;
    environment: VarEnvironment;
  }): Promise<VarRecord[]>;
  listAllGlobal(): Promise<VarRecord[]>;
  listGlobalForKey(key: string): Promise<VarRecord[]>;
  syncGlobalItem(input: GlobalVarSyncInput): Promise<void>;
  upsertMany(items: VarUpsertInput[]): Promise<VarRecord[]>;
  deleteById(id: string): Promise<void>;
  loadLayers(input: {
    workflowId?: string;
    userId?: string;
    environment: VarEnvironment;
  }): Promise<{
    global: Record<string, string>;
    user: Record<string, string>;
    workflow: Record<string, string>;
  }>;
}
