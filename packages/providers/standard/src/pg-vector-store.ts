import { cosineSimilarity } from '@rxwf/knowledge';
import type { ScoredChunk, VectorStorePort } from '@rxwf/providers-contracts';
import type { Pool } from 'pg';

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function createPgVectorStore(pool: Pool): VectorStorePort {
  return {
    async search(opts) {
      if (opts.knowledgeBaseIds.length === 0) return [];

      try {
        const res = await pool.query<{
          id: string;
          knowledge_base_id: string;
          document_id: string;
          document_name: string;
          chunk_index: number;
          text: string;
          metadata_json: string;
          score: number;
        }>(
          `SELECT c.id, c.knowledge_base_id, c.document_id, d.name AS document_name,
                  c.chunk_index, c.text, c.metadata_json,
                  (1 - (c.embedding <=> $1::vector))::float AS score
           FROM knowledge_chunks c
           INNER JOIN knowledge_documents d ON d.id = c.document_id
           WHERE c.knowledge_base_id = ANY($2::text[])
             AND c.embedding IS NOT NULL
           ORDER BY c.embedding <=> $1::vector
           LIMIT $3`,
          [toVectorLiteral(opts.queryEmbedding), opts.knowledgeBaseIds, opts.topK * 3],
        );

        const scored: ScoredChunk[] = [];
        for (const row of res.rows) {
          if (row.score < opts.similarityThreshold) continue;
          scored.push({
            id: row.id,
            knowledgeBaseId: row.knowledge_base_id,
            documentId: row.document_id,
            documentName: row.document_name,
            chunkIndex: row.chunk_index,
            text: row.text,
            score: row.score,
            metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
          });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, opts.topK);
      } catch {
        return searchWithJsonFallback(pool, opts);
      }
    },
  };
}

async function searchWithJsonFallback(
  pool: Pool,
  opts: Parameters<VectorStorePort['search']>[0],
): Promise<ScoredChunk[]> {
  const res = await pool.query<{
    id: string;
    knowledge_base_id: string;
    document_id: string;
    document_name: string;
    chunk_index: number;
    text: string;
    metadata_json: string;
    embedding_json: string;
  }>(
    `SELECT c.id, c.knowledge_base_id, c.document_id, d.name AS document_name,
            c.chunk_index, c.text, c.metadata_json, c.embedding_json
     FROM knowledge_chunks c
     INNER JOIN knowledge_documents d ON d.id = c.document_id
     WHERE c.knowledge_base_id = ANY($1::text[])
       AND c.embedding_json IS NOT NULL`,
    [opts.knowledgeBaseIds],
  );

  const scored: ScoredChunk[] = [];
  for (const row of res.rows) {
    const embedding = JSON.parse(row.embedding_json) as number[];
    const score = cosineSimilarity(opts.queryEmbedding, embedding);
    if (score < opts.similarityThreshold) continue;
    scored.push({
      id: row.id,
      knowledgeBaseId: row.knowledge_base_id,
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      text: row.text,
      score,
      metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.topK);
}
