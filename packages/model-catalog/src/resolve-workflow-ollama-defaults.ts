import type { createModelCatalogService } from './model-catalog-service.js';

export interface WorkflowOllamaDefaults {
  ollamaUrl: string;
  ollamaModel: string;
}

type ModelCatalogService = ReturnType<typeof createModelCatalogService>;

export async function resolveWorkflowOllamaDefaults(
  catalog: ModelCatalogService,
  fallback: WorkflowOllamaDefaults,
): Promise<WorkflowOllamaDefaults> {
  const fromCatalog = await catalog.resolveWorkflowDefaultOllama();
  if (fromCatalog) return fromCatalog;
  return fallback;
}
