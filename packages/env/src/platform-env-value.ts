import {
  getPlatformEnvCatalogEntry,
  PLATFORM_ENV_CATALOG,
  type PlatformEnvKey,
  type PlatformEnvValueType,
} from './platform-env-catalog.js';

export type PlatformEnvParsedValue = string | number | boolean;

function trimRaw(raw: string): string {
  return String(raw ?? '').trim();
}

/** Write-path normalization before validate + DB store. */
export function normalizePlatformEnvValue(
  valueType: PlatformEnvValueType,
  raw: string,
): string {
  const value = trimRaw(raw);
  switch (valueType) {
    case 'bool': {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return 'true';
      if (lower === 'false' || lower === '0' || lower === 'no') return 'false';
      return value;
    }
    case 'int':
    case 'port': {
      if (value === '') return value;
      const n = Number(value);
      if (!Number.isFinite(n) || !Number.isInteger(n)) return value;
      return String(n);
    }
    case 'double': {
      if (value === '') return value;
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      return String(n);
    }
    default:
      return valueType === 'password' ? String(raw ?? '') : value;
  }
}

/** Runtime / expression injection. */
export function parsePlatformEnvValue(
  valueType: PlatformEnvValueType,
  raw: string,
): PlatformEnvParsedValue {
  const value = trimRaw(raw);
  switch (valueType) {
    case 'bool':
      return value === 'true';
    case 'int':
    case 'port': {
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) ? n : Number.NaN;
    }
    case 'double': {
      const n = Number(value);
      return Number.isFinite(n) ? n : Number.NaN;
    }
    default:
      return String(raw ?? '');
  }
}

export function parsePlatformEnvMap(
  map: Record<string, string>,
): Record<string, PlatformEnvParsedValue> {
  const out: Record<string, PlatformEnvParsedValue> = {};
  for (const entry of PLATFORM_ENV_CATALOG) {
    const raw = map[entry.key];
    if (raw === undefined) continue;
    out[entry.key] = parsePlatformEnvValue(entry.valueType, raw);
  }
  // Preserve any non-catalog keys as strings (defensive).
  for (const [key, raw] of Object.entries(map)) {
    if (key in out) continue;
    out[key] = raw;
  }
  return out;
}

export function parsePlatformEnvMapForKey(
  key: string,
  raw: string,
): PlatformEnvParsedValue {
  const entry = getPlatformEnvCatalogEntry(key);
  if (!entry) return raw;
  return parsePlatformEnvValue(entry.valueType, raw);
}

export function normalizeForCatalogKey(key: PlatformEnvKey | string, raw: string): string {
  const entry = getPlatformEnvCatalogEntry(key);
  if (!entry) return String(raw ?? '');
  return normalizePlatformEnvValue(entry.valueType, raw);
}
