import { scoreBm25 } from '@rxwf/knowledge';
import type { KeywordSearchPort, ScoredChunk } from '@rxwf/providers-contracts';
import type { Pool } from 'pg';

export function createPgKeywordSearch(pool: Pool): KeywordSearchPort {
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
                  ts_rank(to_tsvector('simple', c.text), plainto_tsquery('simple', $1))::float AS score
           FROM knowledge_chunks c
           INNER JOIN knowledge_documents d ON d.id = c.document_id
           WHERE c.knowledge_base_id = ANY($2::text[])
             AND to_tsvector('simple', c.text) @@ plainto_tsquery('simple', $1)
           ORDER BY score DESC
           LIMIT $3`,
          [opts.query, opts.knowledgeBaseIds, opts.topK],
        );
        if (res.rows.length > 0) {
          return res.rows.map((row) => ({
            id: row.id,
            knowledgeBaseId: row.knowledge_base_id,
            documentId: row.document_id,
            documentName: row.document_name,
            chunkIndex: row.chunk_index,
            text: row.text,
            score: row.score,
            metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
          }));
        }
      } catch {
        /* fall through to BM25 */
      }

      const res = await pool.query<{
        id: string;
        knowledge_base_id: string;
        document_id: string;
        document_name: string;
        chunk_index: number;
        text: string;
        metadata_json: string;
      }>(
        `SELECT c.id, c.knowledge_base_id, c.document_id, d.name AS document_name,
                c.chunk_index, c.text, c.metadata_json
         FROM knowledge_chunks c
         INNER JOIN knowledge_documents d ON d.id = c.document_id
         WHERE c.knowledge_base_id = ANY($1::text[])`,
        [opts.knowledgeBaseIds],
      );

      const bm25 = scoreBm25(
        opts.query,
        res.rows.map((r) => ({ id: r.id, text: r.text })),
      );
      const scoreById = new Map(bm25.map((b) => [b.id, b.score]));
      const maxBm25 = Math.max(...bm25.map((b) => b.score), 1);
      const scored: ScoredChunk[] = [];
      for (const row of res.rows) {
        const raw = scoreById.get(row.id);
        if (raw === undefined) continue;
        scored.push({
          id: row.id,
          knowledgeBaseId: row.knowledge_base_id,
          documentId: row.document_id,
          documentName: row.document_name,
          chunkIndex: row.chunk_index,
          text: row.text,
          score: raw / maxBm25,
          metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, opts.topK);
    },
  };
}
