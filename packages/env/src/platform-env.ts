import {
  getPlatformEnvCatalogEntry,
  PLATFORM_ENV_CATALOG,
  PLATFORM_ENVIRONMENT,
  PLATFORM_ENV_KEYS,
  type PlatformEnvKey,
  type PlatformEnvPathHost,
  type PlatformEnvValueType,
} from './platform-env-catalog.js';
import { normalizeForCatalogKey, parsePlatformEnvValue } from './platform-env-value.js';
import type { EnvRepositoryPort, EnvVarRecord } from './types.js';

export const PLATFORM_ENV_MASK = '***';

export interface PlatformEnvItem {
  key: PlatformEnvKey;
  value: string;
  sensitive: boolean;
  requiresRestart: boolean;
  labelKey: string;
  descriptionKey: string;
  valueHintKey: string;
  configured: boolean;
  valueType: PlatformEnvValueType;
  pathHost?: PlatformEnvPathHost;
  pathKind?: 'directory' | 'file';
}

export interface PlatformEnvDefaults {
  publicUrl?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  webhookSecret?: string;
  brandProductName?: string;
  brandLogoUrl?: string;
  langchainTracingV2?: string;
  langchainApiKey?: string;
  langchainProject?: string;
  workspaceRoot?: string;
  sandboxCodeTimeoutMs?: string;
}

function defaultForKey(key: PlatformEnvKey, defaults?: PlatformEnvDefaults): string {
  const entry = getPlatformEnvCatalogEntry(key)!;
  const map: Partial<Record<PlatformEnvKey, string | undefined>> = {
    RXWF_PUBLIC_URL: defaults?.publicUrl,
    RXWF_SMTP_HOST: defaults?.smtpHost,
    RXWF_SMTP_PORT: defaults?.smtpPort,
    RXWF_SMTP_SECURE: defaults?.smtpSecure,
    RXWF_SMTP_USER: defaults?.smtpUser,
    RXWF_SMTP_PASSWORD: defaults?.smtpPassword,
    RXWF_SMTP_FROM: defaults?.smtpFrom,
    RXWF_WEBHOOK_SECRET: defaults?.webhookSecret,
    RXWF_BRAND_NAME: defaults?.brandProductName,
    RXWF_BRAND_LOGO_URL: defaults?.brandLogoUrl,
    RXWF_LANGCHAIN_TRACING_V2: defaults?.langchainTracingV2,
    RXWF_LANGCHAIN_API_KEY: defaults?.langchainApiKey,
    RXWF_LANGCHAIN_PROJECT: defaults?.langchainProject,
    RXWF_WORKSPACE_ROOT: defaults?.workspaceRoot,
    RXWF_SANDBOX_CODE_TIMEOUT_MS: defaults?.sandboxCodeTimeoutMs,
  };
  return map[key] ?? entry.defaultValue;
}

function runtimeRecordsByKey(records: EnvVarRecord[]): Map<string, EnvVarRecord> {
  const map = new Map<string, EnvVarRecord>();
  for (const row of records) {
    if (row.scope !== 'global') continue;
    if (row.environment !== PLATFORM_ENVIRONMENT) continue;
    if (!PLATFORM_ENV_KEYS.has(row.key as PlatformEnvKey)) continue;
    map.set(row.key, row);
  }
  return map;
}

export async function listPlatformEnvItems(
  repo: EnvRepositoryPort,
  options: { maskSensitive?: boolean; defaults?: PlatformEnvDefaults } = {},
): Promise<PlatformEnvItem[]> {
  const stored = runtimeRecordsByKey(await repo.listAllGlobal());
  return PLATFORM_ENV_CATALOG.map((entry) => {
    const row = stored.get(entry.key);
    const raw = row?.value ?? defaultForKey(entry.key, options.defaults);
    const configured = Boolean(row);
    const value =
      entry.sensitive && options.maskSensitive !== false && configured
        ? PLATFORM_ENV_MASK
        : raw;
    return {
      key: entry.key,
      value,
      sensitive: entry.sensitive,
      requiresRestart: entry.requiresRestart,
      labelKey: entry.labelKey,
      descriptionKey: entry.descriptionKey,
      valueHintKey: entry.valueHintKey,
      configured,
      valueType: entry.valueType,
      ...(entry.valueType === 'path'
        ? { pathHost: entry.pathHost, pathKind: entry.pathKind }
        : {}),
    };
  });
}

export async function resolvePlatformEnvMap(
  repo: EnvRepositoryPort,
  defaults?: PlatformEnvDefaults,
): Promise<Record<string, string>> {
  const items = await listPlatformEnvItems(repo, {
    maskSensitive: false,
    defaults,
  });
  const out: Record<string, string> = {};
  for (const item of items) {
    out[item.key] = item.value;
  }
  return out;
}

export async function upsertPlatformEnvValues(
  repo: EnvRepositoryPort,
  items: Array<{ key: string; value: string }>,
): Promise<PlatformEnvItem[]> {
  for (const item of items) {
    const entry = getPlatformEnvCatalogEntry(item.key.trim());
    if (!entry) {
      throw new Error(`Unknown platform env key: ${item.key}`);
    }
    const normalized = normalizeForCatalogKey(entry.key, String(item.value));
    const err = entry.validate(normalized);
    if (err) {
      throw new Error(`${entry.key}: ${err}`);
    }
    await repo.upsertPlatformEnv({
      key: entry.key,
      value: normalized,
      sensitive: entry.sensitive,
    });
  }
  return listPlatformEnvItems(repo, { maskSensitive: true });
}

export function platformEnvToRuntimeFields(map: Record<string, string>) {
  const port = parsePlatformEnvValue('port', map.RXWF_SMTP_PORT ?? '587');
  const secure = parsePlatformEnvValue('bool', map.RXWF_SMTP_SECURE ?? 'false');
  const tracing = parsePlatformEnvValue(
    'bool',
    map.RXWF_LANGCHAIN_TRACING_V2 ?? 'false',
  );
  return {
    publicUrl: map.RXWF_PUBLIC_URL ?? '',
    smtp: {
      host: map.RXWF_SMTP_HOST ?? '',
      port: typeof port === 'number' && Number.isFinite(port) ? port : 587,
      secure: secure === true,
      user: map.RXWF_SMTP_USER ?? '',
      password: map.RXWF_SMTP_PASSWORD ?? '',
      from: map.RXWF_SMTP_FROM ?? '',
    },
    webhookSecret: map.RXWF_WEBHOOK_SECRET ?? '',
    brand: {
      productName: map.RXWF_BRAND_NAME ?? 'RX-Workflow',
      logoUrl: map.RXWF_BRAND_LOGO_URL ?? '',
    },
    langchain: {
      tracingV2: tracing === true,
      apiKey: map.RXWF_LANGCHAIN_API_KEY ?? '',
      project: map.RXWF_LANGCHAIN_PROJECT ?? 'rx-workflow',
      enabled:
        tracing === true && Boolean((map.RXWF_LANGCHAIN_API_KEY ?? '').trim()),
    },
    workspaceRoot: map.RXWF_WORKSPACE_ROOT ?? '',
    sandboxCodeTimeoutMs: map.RXWF_SANDBOX_CODE_TIMEOUT_MS ?? '-1',
  };
}
