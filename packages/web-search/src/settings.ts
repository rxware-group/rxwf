import {
  DEFAULT_WEB_SEARCH_SETTINGS,
  type SystemWebSearchSettings,
  type WebSearchProviderId,
} from './types.js';

const PROVIDER_IDS = new Set<WebSearchProviderId>(['tavily', 'brave', 'bing', 'custom']);

export function parseWebSearchSettings(raw: string | null | undefined): SystemWebSearchSettings {
  if (!raw?.trim()) return { ...DEFAULT_WEB_SEARCH_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<SystemWebSearchSettings>;
    const provider = parsed.defaultProvider;
    return {
      enabled: Boolean(parsed.enabled),
      defaultProvider:
        typeof provider === 'string' && PROVIDER_IDS.has(provider as WebSearchProviderId)
          ? (provider as WebSearchProviderId)
          : DEFAULT_WEB_SEARCH_SETTINGS.defaultProvider,
      defaultCredentialId:
        typeof parsed.defaultCredentialId === 'string'
          ? parsed.defaultCredentialId.trim() || undefined
          : undefined,
      maxQueriesPerExecution:
        typeof parsed.maxQueriesPerExecution === 'number' && parsed.maxQueriesPerExecution > 0
          ? Math.floor(parsed.maxQueriesPerExecution)
          : DEFAULT_WEB_SEARCH_SETTINGS.maxQueriesPerExecution,
      timeoutMs:
        typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0
          ? Math.floor(parsed.timeoutMs)
          : DEFAULT_WEB_SEARCH_SETTINGS.timeoutMs,
      maxResults:
        typeof parsed.maxResults === 'number' && parsed.maxResults > 0
          ? Math.floor(parsed.maxResults)
          : DEFAULT_WEB_SEARCH_SETTINGS.maxResults,
      allowedDomains: Array.isArray(parsed.allowedDomains)
        ? parsed.allowedDomains.map(String).filter(Boolean)
        : undefined,
      customBaseUrl:
        typeof parsed.customBaseUrl === 'string'
          ? parsed.customBaseUrl.trim() || undefined
          : undefined,
    };
  } catch {
    return { ...DEFAULT_WEB_SEARCH_SETTINGS };
  }
}

export function serializeWebSearchSettings(settings: SystemWebSearchSettings): string {
  return JSON.stringify(settings);
}
