import { AwfError } from '@rxwf/shared';
import {
  buildRagSystemPrompt,
  chunksToCitations,
  type RagTemplateId,
} from '@rxwf/knowledge';
import type { NodeExecutor } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';

function parseKnowledgeBaseIds(config: Record<string, unknown>): string[] {
  const raw = config.knowledgeBaseIds;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = String(config.knowledgeBaseId ?? '').trim();
  return single ? [single] : [];
}

function resolveQuery(config: Record<string, unknown>, inputItems: { json: Record<string, unknown> }[]): string {
  const fromConfig = String(config.query ?? config.prompt ?? '').trim();
  if (fromConfig) return fromConfig;
  const first = inputItems[0]?.json;
  if (!first) return '';
  return String(first.query ?? first.question ?? first.content ?? first.text ?? '').trim();
}

function usePlatformRagModel(config: Record<string, unknown>): boolean {
  const raw = config.usePlatformRagModel;
  if (raw === false || raw === 'false') return false;
  return true;
}

async function resolveRagAnswerModelRef(
  config: Record<string, unknown>,
  deps: PlusExecutorDeps,
) {
  const fromNode = String(config.model ?? '').trim();
  const hasNodeProvider = String(config.provider ?? '').trim().length > 0;
  if (fromNode || hasNodeProvider || !usePlatformRagModel(config)) {
    if (deps.resolveOllamaModelRef) {
      return deps.resolveOllamaModelRef(config);
    }
    return {
      provider: 'ollama' as const,
      model: fromNode || 'llama3',
    };
  }
  if (deps.resolvePlatformRagModelRef) {
    return deps.resolvePlatformRagModelRef();
  }
  if (deps.resolveOllamaModelRef) {
    return deps.resolveOllamaModelRef(config);
  }
  return { provider: 'ollama' as const, model: 'llama3' };
}

export function createRagExecutors(deps: PlusExecutorDeps): NodeExecutor[] {
  return [
    {
      type: 'ragRetrieve',
      async execute(ctx) {
        if (!deps.knowledge) {
          throw new AwfError('E3001', 'Knowledge RAG is not configured');
        }
        const kbIds = parseKnowledgeBaseIds(ctx.config);
        if (kbIds.length === 0) {
          throw new AwfError('E1004', 'knowledgeBaseIds required');
        }
        const query = resolveQuery(ctx.config, ctx.inputItems);
        if (!query) {
          throw new AwfError('E1004', 'query or prompt required');
        }
        const chunks = await deps.knowledge.queryMany(kbIds, query);
        return {
          status: 'success',
          outputItems: [
            chunks.map((c) => ({
              json: {
                id: c.id,
                text: c.text,
                score: c.score,
                documentId: c.documentId,
                documentName: c.documentName,
                chunkIndex: c.chunkIndex,
                knowledgeBaseId: c.knowledgeBaseId,
              },
            })),
          ],
        };
      },
    },
    {
      type: 'ragAnswer',
      async execute(ctx) {
        if (!deps.knowledge || !deps.ai) {
          throw new AwfError('E3001', 'Knowledge RAG or AI runtime not configured');
        }
        const kbIds = parseKnowledgeBaseIds(ctx.config);
        if (kbIds.length === 0) {
          throw new AwfError('E1004', 'knowledgeBaseIds required');
        }
        const query = resolveQuery(ctx.config, ctx.inputItems);
        if (!query) {
          throw new AwfError('E1004', 'query or prompt required');
        }

        let chunks;
        try {
          chunks = await deps.knowledge.queryMany(kbIds, query);
        } catch (err) {
          if (
            err instanceof AwfError &&
            err.code === 'E3003' &&
            (ctx.config.fallbackToChat === true || ctx.config.fallbackToChat === 'true')
          ) {
            const modelRef = await resolveRagAnswerModelRef(ctx.config, deps);
            let answer = '';
            for await (const t of deps.ai.chat([{ role: 'user', content: query }], {
              model: modelRef,
            })) {
              answer += t;
            }
            return {
              status: 'success',
              outputItems: [[{ json: { answer, citations: [], ragMiss: true } }]],
            };
          }
          throw err;
        }

        const templateId = (
          ctx.config.ragTemplate === 'code' ? 'code' : 'support'
        ) as RagTemplateId;
        const systemPrompt = buildRagSystemPrompt(chunks, templateId);
        const modelRef = await resolveRagAnswerModelRef(ctx.config, deps);
        let answer = '';
        for await (const t of deps.ai.chat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query },
          ],
          { model: modelRef },
        )) {
          answer += t;
        }
        const citations = chunksToCitations(chunks);
        return {
          status: 'success',
          outputItems: [[{ json: { answer, citations, ragMiss: false } }]],
        };
      },
    },
  ];
}
