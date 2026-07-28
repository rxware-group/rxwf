import type { NodeDebugState } from './editor-debug-types.js';

export type KnowledgeChunkPreview = {
  text: string;
  score: number;
  documentName: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
};

export type KnowledgeQueryPreview = {
  query: string;
  knowledgeBaseIds: string[];
  chunks: KnowledgeChunkPreview[];
};

function isKnowledgeQueryPreview(value: unknown): value is KnowledgeQueryPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.query === 'string' &&
    Array.isArray(record.knowledgeBaseIds) &&
    Array.isArray(record.chunks)
  );
}

export function formatKnowledgeRetrievalDetail(
  query: string | undefined,
  chunks: KnowledgeChunkPreview[] | undefined,
): string | undefined {
  const trimmedQuery = query?.trim() ?? '';
  const list = chunks ?? [];
  if (!trimmedQuery && list.length === 0) return undefined;

  const parts: string[] = [];
  if (trimmedQuery) parts.push(trimmedQuery);

  for (let i = 0; i < list.length; i++) {
    const chunk = list[i]!;
    const doc = chunk.documentName?.trim() || chunk.documentId || `#${i + 1}`;
    const score =
      typeof chunk.score === 'number' && Number.isFinite(chunk.score)
        ? chunk.score.toFixed(3)
        : String(chunk.score ?? '');
    parts.push(`[${i + 1}] ${doc} · ${score}\n${chunk.text}`);
  }

  return parts.join('\n\n');
}

export function resolveKnowledgeQueryFromDebug(debug?: NodeDebugState): unknown | null {
  if (!debug) return null;
  const items = debug.outputItems?.[0] ?? [];
  if (items.length > 0) {
    if (items.length === 1) {
      const json = items[0]?.json;
      return isKnowledgeQueryPreview(json) ? json : json ?? null;
    }
    return items.map((item, index) => ({
      round: index + 1,
      ...item.json,
    }));
  }
  for (let i = (debug.agentStream?.length ?? 0) - 1; i >= 0; i--) {
    const entry = debug.agentStream?.[i];
    if (entry?.type !== 'satellite_knowledge_query') continue;
    const query = String(entry.query ?? '');
    const knowledgeBaseIds = Array.isArray(entry.knowledgeBaseIds)
      ? entry.knowledgeBaseIds.map(String)
      : [];
    const chunks = Array.isArray(entry.chunks) ? entry.chunks : [];
    return { query, knowledgeBaseIds, chunks };
  }
  return null;
}
