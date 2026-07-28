/** Platform-owned env vars (DB `env_vars`); not OS / process.env. */
export const PLATFORM_ENVIRONMENT = 'runtime' as const;

export type PlatformEnvKey =
  | 'RXWF_PUBLIC_URL'
  | 'RXWF_SMTP_HOST'
  | 'RXWF_SMTP_PORT'
  | 'RXWF_SMTP_SECURE'
  | 'RXWF_SMTP_USER'
  | 'RXWF_SMTP_PASSWORD'
  | 'RXWF_SMTP_FROM'
  | 'RXWF_WEBHOOK_SECRET'
  | 'RXWF_BRAND_NAME'
  | 'RXWF_BRAND_LOGO_URL'
  | 'RXWF_LANGCHAIN_TRACING_V2'
  | 'RXWF_LANGCHAIN_API_KEY'
  | 'RXWF_LANGCHAIN_PROJECT'
  | 'RXWF_WORKSPACE_ROOT'
  | 'RXWF_SANDBOX_CODE_TIMEOUT_MS';

export type PlatformEnvValueType =
  | 'string'
  | 'password'
  | 'url'
  | 'path'
  | 'bool'
  | 'int'
  | 'port'
  | 'double';

/** Where a path value lives; drives browse target. */
export type PlatformEnvPathHost = 'controlPlane' | 'runner';

export interface PlatformEnvCatalogEntry {
  key: PlatformEnvKey;
  labelKey: string;
  descriptionKey: string;
  valueHintKey: string;
  sensitive: boolean;
  requiresRestart: boolean;
  defaultValue: string;
  valueType: PlatformEnvValueType;
  min?: number;
  max?: number;
  pathKind?: 'directory' | 'file';
  pathHost?: PlatformEnvPathHost;
  /** Legacy `system_settings` key for migration */
  legacySettingKey?: string;
  validate: (value: string) => string | null;
}

const boolValidator = (value: string) =>
  value === 'true' || value === 'false' ? null : 'Must be true or false';

const portValidator = (value: string) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 'Port must be 1–65535';
  return null;
};

const urlValidator = (value: string) => {
  if (!value.trim()) return 'URL is required';
  try {
    new URL(value);
    return null;
  } catch {
    return 'Invalid URL';
  }
};

const optionalUrlValidator = (value: string) => {
  if (!value.trim()) return null;
  return urlValidator(value);
};

const intMinValidator =
  (min: number, allowNegative = false) =>
  (value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Must be an integer';
    if (!allowNegative && n < min) return `Must be >= ${min}`;
    if (allowNegative && n < min) return `Must be >= ${min}`;
    return null;
  };

/** Reusable finite float validator (optional bounds). */
export const doubleValidator =
  (min?: number, max?: number) =>
  (value: string) => {
    if (!value.trim()) return 'Must be a finite number';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Must be a finite number';
    if (min != null && n < min) return `Must be >= ${min}`;
    if (max != null && n > max) return `Must be <= ${max}`;
    return null;
  };

export const LEGACY_SANDBOX_TIMEOUT_KEY = 'SANDBOX_CODE_TIMEOUT_MS';

export const PLATFORM_ENV_CATALOG: PlatformEnvCatalogEntry[] = [
  {
    key: 'RXWF_PUBLIC_URL',
    labelKey: 'platformEnv.RXWF_PUBLIC_URL.label',
    descriptionKey: 'platformEnv.RXWF_PUBLIC_URL.description',
    valueHintKey: 'platformEnv.RXWF_PUBLIC_URL.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: 'http://localhost:8787',
    valueType: 'url',
    legacySettingKey: 'publicUrl',
    validate: urlValidator,
  },
  {
    key: 'RXWF_SMTP_HOST',
    labelKey: 'platformEnv.RXWF_SMTP_HOST.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_HOST.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_HOST.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'string',
    legacySettingKey: 'smtp.host',
    validate: () => null,
  },
  {
    key: 'RXWF_SMTP_PORT',
    labelKey: 'platformEnv.RXWF_SMTP_PORT.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_PORT.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_PORT.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '587',
    valueType: 'port',
    min: 1,
    max: 65535,
    legacySettingKey: 'smtp.port',
    validate: portValidator,
  },
  {
    key: 'RXWF_SMTP_SECURE',
    labelKey: 'platformEnv.RXWF_SMTP_SECURE.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_SECURE.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_SECURE.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: 'false',
    valueType: 'bool',
    legacySettingKey: 'smtp.secure',
    validate: boolValidator,
  },
  {
    key: 'RXWF_SMTP_USER',
    labelKey: 'platformEnv.RXWF_SMTP_USER.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_USER.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_USER.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'string',
    legacySettingKey: 'smtp.user',
    validate: () => null,
  },
  {
    key: 'RXWF_SMTP_PASSWORD',
    labelKey: 'platformEnv.RXWF_SMTP_PASSWORD.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_PASSWORD.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_PASSWORD.valueHint',
    sensitive: true,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'password',
    legacySettingKey: 'smtp.password',
    validate: () => null,
  },
  {
    key: 'RXWF_SMTP_FROM',
    labelKey: 'platformEnv.RXWF_SMTP_FROM.label',
    descriptionKey: 'platformEnv.RXWF_SMTP_FROM.description',
    valueHintKey: 'platformEnv.RXWF_SMTP_FROM.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'string',
    legacySettingKey: 'smtp.from',
    validate: () => null,
  },
  {
    key: 'RXWF_WEBHOOK_SECRET',
    labelKey: 'platformEnv.RXWF_WEBHOOK_SECRET.label',
    descriptionKey: 'platformEnv.RXWF_WEBHOOK_SECRET.description',
    valueHintKey: 'platformEnv.RXWF_WEBHOOK_SECRET.valueHint',
    sensitive: true,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'password',
    legacySettingKey: 'webhookSecret',
    validate: () => null,
  },
  {
    key: 'RXWF_BRAND_NAME',
    labelKey: 'platformEnv.RXWF_BRAND_NAME.label',
    descriptionKey: 'platformEnv.RXWF_BRAND_NAME.description',
    valueHintKey: 'platformEnv.RXWF_BRAND_NAME.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: 'RX-Workflow',
    valueType: 'string',
    legacySettingKey: 'brand.productName',
    validate: () => null,
  },
  {
    key: 'RXWF_BRAND_LOGO_URL',
    labelKey: 'platformEnv.RXWF_BRAND_LOGO_URL.label',
    descriptionKey: 'platformEnv.RXWF_BRAND_LOGO_URL.description',
    valueHintKey: 'platformEnv.RXWF_BRAND_LOGO_URL.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'url',
    legacySettingKey: 'brand.logoUrl',
    validate: optionalUrlValidator,
  },
  {
    key: 'RXWF_LANGCHAIN_TRACING_V2',
    labelKey: 'platformEnv.RXWF_LANGCHAIN_TRACING_V2.label',
    descriptionKey: 'platformEnv.RXWF_LANGCHAIN_TRACING_V2.description',
    valueHintKey: 'platformEnv.RXWF_LANGCHAIN_TRACING_V2.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: 'false',
    valueType: 'bool',
    legacySettingKey: 'langchain.tracingV2',
    validate: boolValidator,
  },
  {
    key: 'RXWF_LANGCHAIN_API_KEY',
    labelKey: 'platformEnv.RXWF_LANGCHAIN_API_KEY.label',
    descriptionKey: 'platformEnv.RXWF_LANGCHAIN_API_KEY.description',
    valueHintKey: 'platformEnv.RXWF_LANGCHAIN_API_KEY.valueHint',
    sensitive: true,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'password',
    legacySettingKey: 'langchain.apiKey',
    validate: () => null,
  },
  {
    key: 'RXWF_LANGCHAIN_PROJECT',
    labelKey: 'platformEnv.RXWF_LANGCHAIN_PROJECT.label',
    descriptionKey: 'platformEnv.RXWF_LANGCHAIN_PROJECT.description',
    valueHintKey: 'platformEnv.RXWF_LANGCHAIN_PROJECT.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: 'rx-workflow',
    valueType: 'string',
    legacySettingKey: 'langchain.project',
    validate: () => null,
  },
  {
    key: 'RXWF_WORKSPACE_ROOT',
    labelKey: 'platformEnv.RXWF_WORKSPACE_ROOT.label',
    descriptionKey: 'platformEnv.RXWF_WORKSPACE_ROOT.description',
    valueHintKey: 'platformEnv.RXWF_WORKSPACE_ROOT.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '',
    valueType: 'path',
    pathKind: 'directory',
    pathHost: 'runner',
    legacySettingKey: 'rxwf.workspaceRoot',
    validate: () => null,
  },
  {
    key: 'RXWF_SANDBOX_CODE_TIMEOUT_MS',
    labelKey: 'platformEnv.RXWF_SANDBOX_CODE_TIMEOUT_MS.label',
    descriptionKey: 'platformEnv.RXWF_SANDBOX_CODE_TIMEOUT_MS.description',
    valueHintKey: 'platformEnv.RXWF_SANDBOX_CODE_TIMEOUT_MS.valueHint',
    sensitive: false,
    requiresRestart: false,
    defaultValue: '-1',
    valueType: 'int',
    min: -1,
    validate: intMinValidator(-1, true),
  },
];

export const PLATFORM_ENV_KEYS = new Set(
  PLATFORM_ENV_CATALOG.map((e) => e.key),
) as Set<PlatformEnvKey>;

export function getPlatformEnvCatalogEntry(
  key: string,
): PlatformEnvCatalogEntry | undefined {
  return PLATFORM_ENV_CATALOG.find((e) => e.key === key);
}

export function assertPlatformEnvKey(key: string): PlatformEnvKey {
  const entry = getPlatformEnvCatalogEntry(key);
  if (!entry) {
    throw new Error(`Unknown platform env key: ${key}`);
  }
  return entry.key;
}
