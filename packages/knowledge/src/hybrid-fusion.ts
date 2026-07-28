import type { ScoredChunk } from '@rxwf/providers-contracts';

/** Reciprocal Rank Fusion (k=60 default). */
export function fuseRrf(
  lists: ScoredChunk[][],
  topK: number,
  k = 60,
): ScoredChunk[] {
  const byId = new Map<string, ScoredChunk & { rrf: number }>();

  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const rrf = 1 / (k + rank + 1);
      const prev = byId.get(chunk.id);
      if (prev) {
        prev.rrf += rrf;
        prev.score = prev.rrf;
      } else {
        byId.set(chunk.id, { ...chunk, rrf, score: rrf });
      }
    });
  }

  return [...byId.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ rrf: _r, ...c }) => c);
}

export function normalizeScores(chunks: ScoredChunk[]): ScoredChunk[] {
  if (chunks.length === 0) return [];
  const max = Math.max(...chunks.map((c) => c.score));
  const min = Math.min(...chunks.map((c) => c.score));
  const span = max - min || 1;
  return chunks.map((c) => ({
    ...c,
    score: (c.score - min) / span,
  }));
}
