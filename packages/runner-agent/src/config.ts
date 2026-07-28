import { readFileSync, writeFileSync } from 'node:fs';

export type RunnerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RunnerAgentConfig {
  serverUrl: string;
  runnerId?: string;
  credentialFile: string;
  name: string;
  maxConcurrent?: number;
  extensions?: string[];
  labels?: string[];
  /** Base URL of co-located crewai-runner Sidecar (registers `crewai` capability) */
  crewaiSidecarUrl?: string;
  logLevel?: RunnerLogLevel;
  shutdownTimeoutMs?: number;
}

const LOG_LEVELS = new Set<RunnerLogLevel>(['debug', 'info', 'warn', 'error']);

function assertObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(
  raw: Record<string, unknown>,
  field: keyof RunnerAgentConfig,
): string {
  const value = raw[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${String(field)} is required`);
  }
  return value.trim();
}

function optionalString(raw: Record<string, unknown>, field: keyof RunnerAgentConfig): string | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${String(field)} must be a non-empty string when provided`);
  }
  return value.trim();
}

function optionalPositiveInteger(
  raw: Record<string, unknown>,
  field: keyof RunnerAgentConfig,
): number | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${String(field)} must be a positive integer when provided`);
  }
  return value;
}

function optionalStringArray(
  raw: Record<string, unknown>,
  field: keyof RunnerAgentConfig,
): string[] | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${String(field)} must be an array of non-empty strings when provided`);
  }
  return value.map((item) => item.trim());
}

function optionalLogLevel(raw: Record<string, unknown>): RunnerLogLevel | undefined {
  const value = raw.logLevel;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !LOG_LEVELS.has(value as RunnerLogLevel)) {
    throw new Error('logLevel must be one of debug, info, warn, error when provided');
  }
  return value as RunnerLogLevel;
}

export function loadRunnerConfig(path: string): RunnerAgentConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read runner config at ${path}: ${message}`);
  }

  const raw = assertObject(parsed, path);

  const config: RunnerAgentConfig = {
    serverUrl: requireNonEmptyString(raw, 'serverUrl'),
    credentialFile: requireNonEmptyString(raw, 'credentialFile'),
    name: requireNonEmptyString(raw, 'name'),
  };

  const runnerId = optionalString(raw, 'runnerId');
  if (runnerId !== undefined) config.runnerId = runnerId;

  const maxConcurrent = optionalPositiveInteger(raw, 'maxConcurrent');
  if (maxConcurrent !== undefined) config.maxConcurrent = maxConcurrent;

  const extensions = optionalStringArray(raw, 'extensions');
  if (extensions !== undefined) config.extensions = extensions;

  const labels = optionalStringArray(raw, 'labels');
  if (labels !== undefined) config.labels = labels;

  const crewaiSidecarUrl = optionalString(raw, 'crewaiSidecarUrl');
  if (crewaiSidecarUrl !== undefined) config.crewaiSidecarUrl = crewaiSidecarUrl;

  const logLevel = optionalLogLevel(raw);
  if (logLevel !== undefined) config.logLevel = logLevel;

  const shutdownTimeoutMs = optionalPositiveInteger(raw, 'shutdownTimeoutMs');
  if (shutdownTimeoutMs !== undefined) config.shutdownTimeoutMs = shutdownTimeoutMs;

  return config;
}

export function updateRunnerConfigRunnerId(path: string, runnerId: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read runner config at ${path}: ${message}`);
  }

  const raw = assertObject(parsed, path);
  raw.runnerId = runnerId;
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}
