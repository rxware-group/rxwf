import type { EnvEnvironment, EnvRepositoryPort } from './types.js';
import { PLATFORM_ENVIRONMENT } from './platform-env-catalog.js';
import { resolvePlatformEnvMap } from './platform-env.js';

export async function loadResolvedEnv(
  repo: EnvRepositoryPort,
  _input?: {
    workflowId?: string;
    userId?: string;
    environment?: EnvEnvironment;
  },
): Promise<Record<string, string>> {
  return resolvePlatformEnvMap(repo);
}

export function normalizeStoredEnvironment(stored: string): EnvEnvironment {
  if (stored === 'prod') return 'prod';
  if (
    stored === 'test' ||
    stored === 'dev' ||
    stored === 'staging' ||
    stored === 'development'
  ) {
    return 'test';
  }
  return 'prod';
}

export { PLATFORM_ENVIRONMENT };
