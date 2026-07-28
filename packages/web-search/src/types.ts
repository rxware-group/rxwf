export type WebSearchProviderId = 'tavily' | 'brave' | 'bing' | 'custom';

export interface WebSearchProviderCreds {
  apiKey?: string;
  baseUrl?: string;
}

export interface SystemWebSearchSettings {
  enabled: boolean;
  defaultProvider: WebSearchProviderId;
  defaultCredentialId?: string;
  maxQueriesPerExecution: number;
  timeoutMs: number;
  maxResults: number;
  allowedDomains?: string[];
  customBaseUrl?: string;
}

export const DEFAULT_WEB_SEARCH_SETTINGS: SystemWebSearchSettings = {
  enabled: false,
  defaultProvider: 'tavily',
  maxQueriesPerExecution: 10,
  timeoutMs: 30_000,
  maxResults: 10,
};
