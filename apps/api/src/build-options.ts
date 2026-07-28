import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { EmbeddingProvider } from '@rxwf/knowledge';
import type { LiteDatabase } from '@rxwf/providers-lite';
import type { InvokeCrewToolFn } from './execution/crew-tool-bridge-types.js';

export interface BuildAppOptions {
  db?: LiteDatabase;
  logger?: boolean;
  disableScheduler?: boolean;
  disableJobProcessor?: boolean;
  featurePlus?: boolean;
  aiRuntime?: AiRuntime;
  /** Override embedding provider for knowledge RAG (tests). */
  createEmbeddings?: (model: string) => EmbeddingProvider;
  /** Seed knowledge.config + test model catalog (integration tests). */
  seedKnowledgePlatformConfig?: boolean;
  /** Override crew tool bridge handler (tests / future wiring). */
  invokeCrewTool?: InvokeCrewToolFn;
}
