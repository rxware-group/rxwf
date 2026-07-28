export type RunnerToolCapability =
  | 'skill:filesystem'
  | 'shell'
  | 'web_search'
  /** Admin path browse (env UI); not gated by scanRoots */
  | 'admin:filesystem';

export interface WebSearchProviderConfig {
  providerId: 'tavily' | 'brave' | 'bing' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxResults?: number;
  allowedDomains?: string[];
}

export interface RunnerToolInvokeRequest {
  invokeId: string;
  executionId: string;
  nodeRunId: string;
  capability: RunnerToolCapability;
  method: string;
  args: Record<string, unknown>;
  /** filesystem/shell 必填；web_search 可省略 */
  scanRoots?: string[];
  timeoutMs: number;
  /** 仅 capability=web_search 时使用 */
  providerConfig?: WebSearchProviderConfig;
}

export interface RunnerToolInvokeResult {
  invokeId: string;
  status: 'success' | 'failed';
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}
