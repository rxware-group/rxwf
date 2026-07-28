import type { VarEnvironment, VariablesRepositoryPort } from './types.js';
import { resolveVarLayers } from './resolve.js';

export async function loadResolvedVars(
  repo: VariablesRepositoryPort,
  input: {
    workflowId: string;
    userId?: string;
    environment: VarEnvironment;
  },
): Promise<Record<string, string>> {
  const layers = await repo.loadLayers({
    workflowId: input.workflowId,
    userId: input.userId,
    environment: input.environment,
  });
  return resolveVarLayers(layers);
}

export function normalizeStoredEnvironment(stored: string): VarEnvironment {
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
