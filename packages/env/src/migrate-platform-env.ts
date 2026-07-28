import {
  LEGACY_SANDBOX_TIMEOUT_KEY,
  PLATFORM_ENV_CATALOG,
  PLATFORM_ENVIRONMENT,
  PLATFORM_ENV_KEYS,
  type PlatformEnvKey,
} from './platform-env-catalog.js';
import type { EnvRepositoryPort, EnvVarRecord } from './types.js';

export interface LegacySettingsReader {
  get(key: string): Promise<string | null>;
}

function pickMergedValue(rows: EnvVarRecord[]): string | null {
  const prod = rows.find((r) => r.environment === 'prod');
  if (prod) return prod.value;
  const test = rows.find((r) => r.environment === 'test');
  if (test) return test.value;
  const runtime = rows.find((r) => r.environment === PLATFORM_ENVIRONMENT);
  return runtime?.value ?? null;
}

export async function migratePlatformEnv(
  repo: EnvRepositoryPort,
  settings?: LegacySettingsReader,
): Promise<void> {
  const all = await repo.listAllGlobal();
  const byKey = new Map<string, EnvVarRecord[]>();
  for (const row of all) {
    const list = byKey.get(row.key) ?? [];
    list.push(row);
    byKey.set(row.key, list);
  }

  const resolved = new Map<PlatformEnvKey, string>();

  const legacySandbox = byKey.get(LEGACY_SANDBOX_TIMEOUT_KEY);
  if (legacySandbox?.length) {
    const v = pickMergedValue(legacySandbox);
    if (v != null) resolved.set('RXWF_SANDBOX_CODE_TIMEOUT_MS', v);
  }

  for (const entry of PLATFORM_ENV_CATALOG) {
    if (resolved.has(entry.key)) continue;
    const rows = byKey.get(entry.key);
    const merged = rows?.length ? pickMergedValue(rows) : null;
    if (merged != null) {
      resolved.set(entry.key, merged);
      continue;
    }
    if (entry.legacySettingKey && settings) {
      const fromSettings = await settings.get(entry.legacySettingKey);
      if (fromSettings != null && fromSettings !== '') {
        resolved.set(entry.key, fromSettings);
      }
    }
  }

  for (const entry of PLATFORM_ENV_CATALOG) {
    const value = resolved.get(entry.key) ?? entry.defaultValue;
    await repo.upsertPlatformEnv({
      key: entry.key,
      value,
      sensitive: entry.sensitive,
    });
  }

  const fresh = await repo.listAllGlobal();
  for (const row of fresh) {
    const keep =
      row.scope === 'global' &&
      row.environment === PLATFORM_ENVIRONMENT &&
      PLATFORM_ENV_KEYS.has(row.key as PlatformEnvKey);
    if (!keep) {
      await repo.deleteById(row.id);
    }
  }
}

export async function seedPlatformEnvDefaults(repo: EnvRepositoryPort): Promise<void> {
  for (const entry of PLATFORM_ENV_CATALOG) {
    const existing = await repo.listPlatformEnvForKey(entry.key);
    if (existing) continue;
    await repo.upsertPlatformEnv({
      key: entry.key,
      value: entry.defaultValue,
      sensitive: entry.sensitive,
    });
  }
}
