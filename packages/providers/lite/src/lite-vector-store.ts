import { cosineSimilarity } from '@rxwf/knowledge';
import type { ScoredChunk, VectorStorePort } from '@rxwf/providers-contracts';
import { eq, inArray } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { knowledgeChunks, knowledgeDocuments } from './drizzle/schema.js';

export function createLiteVectorStore(db: LiteDatabase): VectorStorePort {
  return {
    async search(opts) {
      const rows = await db
        .select({
          chunk: knowledgeChunks,
          docName: knowledgeDocuments.name,
        })
        .from(knowledgeChunks)
        .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
        .where(inArray(knowledgeChunks.knowledgeBaseId, opts.knowledgeBaseIds));

      const scored: ScoredChunk[] = [];
      for (const row of rows) {
        const embedding = JSON.parse(row.chunk.embeddingJson) as number[];
        const score = cosineSimilarity(opts.queryEmbedding, embedding);
        if (score < opts.similarityThreshold) continue;
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
