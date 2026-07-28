import { scoreBm25 } from '@rxwf/knowledge';
import type { KeywordSearchPort, ScoredChunk } from '@rxwf/providers-contracts';
import { eq, inArray } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { knowledgeChunks, knowledgeDocuments } from './drizzle/schema.js';

export function createLiteKeywordSearch(db: LiteDatabase): KeywordSearchPort {
  return {
    async search(opts) {
      if (opts.knowledgeBaseIds.length === 0) return [];
      const rows = await db
        .select({
          chunk: knowledgeChunks,
          docName: knowledgeDocuments.name,
        })
        .from(knowledgeChunks)
        .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
        .where(inArray(knowledgeChunks.knowledgeBaseId, opts.knowledgeBaseIds));

      const bm25 = scoreBm25(
        opts.query,
        rows.map((r) => ({ id: r.chunk.id, text: r.chunk.text })),
      );
      const scoreById = new Map(bm25.map((b) => [b.id, b.score]));
      const maxBm25 = Math.max(...bm25.map((b) => b.score), 1);

      const scored: ScoredChunk[] = [];
      for (const row of rows) {
        const raw = scoreById.get(row.chunk.id);
        if (raw === undefined) continue;
        const score = raw / maxBm25;
        scored.push({
          id: row.chunk.id,
          knowledgeBaseId: row.chunk.knowledgeBaseId,
          documentId: row.chunk.documentId,
          documentName: row.docName,
          chunkIndex: row.chunk.chunkIndex,
          text: row.chunk.text,
          score,
          metadata: JSON.parse(row.chunk.metadataJson) as Record<string, unknown>,
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, opts.topK);
    },
  };
}
