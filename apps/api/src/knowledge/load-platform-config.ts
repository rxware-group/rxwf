import {
  parseKnowledgePlatformConfig,
  serializeKnowledgePlatformConfig,
  type KnowledgePlatformConfig,
} from '@rxwf/knowledge';
import { SETTING_KEYS, type SystemSettingsService } from '@rxwf/system-settings';

export async function loadKnowledgePlatformConfig(
  settingsService: SystemSettingsService,
): Promise<KnowledgePlatformConfig> {
  const raw = await settingsService.get(SETTING_KEYS.knowledgeConfig);
  return parseKnowledgePlatformConfig(raw);
}

export async function saveKnowledgePlatformConfig(
  settingsService: SystemSettingsService,
  config: KnowledgePlatformConfig,
): Promise<void> {
  await settingsService.set(SETTING_KEYS.knowledgeConfig, serializeKnowledgePlatformConfig(config));
}
