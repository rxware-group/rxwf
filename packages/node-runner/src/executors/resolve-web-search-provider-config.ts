import type { WebSearchProviderConfig } from '@rxwf/runner-protocol';
import type { WorkflowDefinition, WorkflowNode } from '@rxwf/workflow';

export interface WebSearchSystemSettings {
  enabled: boolean;
  defaultProvider: WebSearchProviderConfig['providerId'];
  defaultCredentialId?: string;
  timeoutMs: number;
  maxResults: number;
  allowedDomains?: string[];
  customBaseUrl?: string;
}

const PROVIDER_IDS = new Set<WebSearchProviderConfig['providerId']>([
  'tavily',
  'brave',
  'bing',
  'custom',
]);

function parseProvider(raw: unknown): WebSearchProviderConfig['providerId'] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const id = raw.trim() as WebSearchProviderConfig['providerId'];
  return PROVIDER_IDS.has(id) ? id : undefined;
}

function inheritConfigEnabled(params: Record<string, unknown>): boolean {
  const raw = params.inheritConfig;
  if (raw === false || raw === 'false') return false;
  return true;
}

export interface ResolveWebSearchProviderConfigInput {
  toolNode: WorkflowNode;
  workflowSettings?: WorkflowDefinition['settings'];
  systemSettings: WebSearchSystemSettings;
  resolveCredential?: (credentialId: string) => Promise<Record<string, string>>;
}

export async function resolveWebSearchProviderConfig(
  input: ResolveWebSearchProviderConfigInput,
): Promise<WebSearchProviderConfig | undefined> {
  const params = input.toolNode.parameters;
  const wfWebSearch = input.workflowSettings?.webSearch as Record<string, unknown> | undefined;
  const inherit = inheritConfigEnabled(params);
  const credentialMode = String(params.credentialMode ?? 'platform').trim();

  let enabled = input.systemSettings.enabled;
  if (wfWebSearch?.enabled === true) enabled = true;
  if (wfWebSearch?.enabled === false) enabled = false;
  if (!enabled) return undefined;

  let providerId: WebSearchProviderConfig['providerId'] | undefined;
  let credentialId: string | undefined;
  let timeoutMs = input.systemSettings.timeoutMs;
  let maxResults = input.systemSettings.maxResults;
  let allowedDomains = input.systemSettings.allowedDomains;
  let baseUrl = input.systemSettings.customBaseUrl;

  if (typeof wfWebSearch?.timeoutMs === 'number' && wfWebSearch.timeoutMs > 0) {
    timeoutMs = Math.floor(wfWebSearch.timeoutMs);
  }
  if (typeof wfWebSearch?.maxResults === 'number' && wfWebSearch.maxResults > 0) {
    maxResults = Math.floor(wfWebSearch.maxResults);
  }
  if (Array.isArray(wfWebSearch?.allowedDomains)) {
    allowedDomains = wfWebSearch.allowedDomains.map(String).filter(Boolean);
  }
  if (typeof wfWebSearch?.customBaseUrl === 'string' && wfWebSearch.customBaseUrl.trim()) {
    baseUrl = wfWebSearch.customBaseUrl.trim();
  }

  if (inherit) {
    providerId =
      parseProvider(wfWebSearch?.defaultProvider ?? wfWebSearch?.provider) ??
      input.systemSettings.defaultProvider;
    credentialId =
      (typeof wfWebSearch?.defaultCredentialId === 'string'
        ? wfWebSearch.defaultCredentialId.trim()
        : undefined) ||
      (typeof wfWebSearch?.credentialId === 'string'
        ? wfWebSearch.credentialId.trim()
        : undefined) ||
      input.systemSettings.defaultCredentialId?.trim();
  } else {
    providerId = parseProvider(params.provider);
    credentialId =
      typeof params.credentialId === 'string' ? params.credentialId.trim() : undefined;
    if (typeof params.timeoutMs === 'number' && params.timeoutMs > 0) {
      timeoutMs = Math.floor(params.timeoutMs);
    }
    if (typeof params.maxResults === 'number' && params.maxResults > 0) {
      maxResults = Math.floor(params.maxResults);
    }
  }

  if (!providerId) return undefined;

  const config: WebSearchProviderConfig = {
    providerId,
    timeoutMs,
    maxResults,
    allowedDomains,
    baseUrl: providerId === 'custom' ? baseUrl : undefined,
  };

  if (credentialMode === 'runner-local') {
    return config;
  }

  if (!credentialId || !input.resolveCredential) {
    return undefined;
  }

  const creds = await input.resolveCredential(credentialId);
  const apiKey = creds.apiKey?.trim();
  if (providerId !== 'custom' && !apiKey) {
    return undefined;
  }

  config.apiKey = apiKey;
  if (providerId === 'custom') {
    config.baseUrl = baseUrl?.trim() || creds.baseUrl?.trim();
    if (!config.baseUrl) return undefined;
  }

  return config;
}
