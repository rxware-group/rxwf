import type { EnvRepositoryPort } from '@rxwf/env';
import { migratePlatformEnv, type LegacySettingsReader } from '@rxwf/env';
import type { SystemSettingsService } from '@rxwf/system-settings';

export async function ensurePlatformEnv(
  repo: EnvRepositoryPort,
  settingsService?: SystemSettingsService,
): Promise<void> {
  const settings: LegacySettingsReader | undefined = settingsService
    ? {
        get: (key) => settingsService.get(key),
      }
    : undefined;
  await migratePlatformEnv(repo, settings);
}
