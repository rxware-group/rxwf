import type { WebSearchPort } from '@rxwf/providers-contracts';
import { SETTING_KEYS } from '@rxwf/system-settings';
import type { SystemSettingsService } from '@rxwf/system-settings';
import {
  createWebSearchPort,
  parseWebSearchSettings,
  type SystemWebSearchSettings,
} from '@rxwf/web-search';

export async function loadWebSearchSettings(
  settingsService: SystemSettingsService,
): Promise<SystemWebSearchSettings> {
  const raw = await settingsService.get(SETTING_KEYS.webSearchConfig);
  return parseWebSearchSettings(raw);
}

export async function createWebSearchService(deps: {
  settingsService: SystemSettingsService;
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
}): Promise<WebSearchPort | undefined> {
  const settings = await loadWebSearchSettings(deps.settingsService);
  if (!settings.enabled) return undefined;
  if (!settings.defaultCredentialId) return undefined;

  const creds = deps.credentialResolver
    ? await deps.credentialResolver(settings.defaultCredentialId)
    : {};
  const apiKey = creds.apiKey?.trim();
  if (settings.defaultProvider !== 'custom' && !apiKey) return undefined;

  return createWebSearchPort(settings.defaultProvider, {
    apiKey,
    baseUrl:
      settings.defaultProvider === 'custom'
        ? settings.customBaseUrl?.trim() || creds.baseUrl?.trim()
        : undefined,
  });
}
