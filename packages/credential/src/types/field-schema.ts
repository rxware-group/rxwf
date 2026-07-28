export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

export interface CredentialTypeDefinition {
  id: string;
  displayName: string;
  description?: string;
  fields: CredentialFieldSchema[];
  applyAuth: (data: Record<string, unknown>) => Record<string, string>;
  testConnection?: (
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message?: string }>;
}

/** UI/API 序列化用（不含函数） */
export interface CredentialTypeSummary {
  id: string;
  displayName: string;
  description?: string;
  fields: CredentialFieldSchema[];
}
