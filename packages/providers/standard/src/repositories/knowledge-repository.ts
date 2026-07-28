import { and, desc, eq, inArray } from 'drizzle-orm';
import type {
  KnowledgeBaseRecord,
  KnowledgeDocumentRecord,
  KnowledgeRepository,
} from '@rxwf/providers-contracts';
import type { Pool } from 'pg';
import type { StandardDatabase } from '../drizzle/client.js';
import {
  knowledgeBases,
  knowledgeChunks,
  knowledgeDocuments,
} from '../drizzle/schema.js';

function thresholdToStore(n: number): number {
  return Math.round(n * 100);
}

function thresholdFromStore(n: number): number {
  return n / 100;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export function createStandardKnowledgeRepository(
  db: StandardDatabase,
  pool: Pool,
): KnowledgeRepository {
  return {
    async createBase(input) {
      const now = new Date();
      await db.insert(knowledgeBases).values({
        id: input.id,
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId,
        embeddingModel: input.embeddingModel,
        chunkSize: input.chunkSize,
        chunkOverlap: input.chunkOverlap,
        topK: input.topK,
        similarityThreshold: thresholdToStore(input.similarityThreshold),
        hybridSearch: input.hybridSearchEnabled,
        createdAt: now,
        updatedAt: now,
      });
      return { ...input, createdAt: now, updatedAt: now };
    },

    async updateBase(id, patch) {
      const existing = await this.getBase(id);
      if (!existing) return null;
      const now = new Date();
      const next = {
        ...existing,
        ...patch,
        similarityThreshold:
          patch.similarityThreshold !== undefined
            ? patch.similarityThreshold
            : existing.similarityThreshold,
        updatedAt: now,
      };
      await db
        .update(knowledgeBases)
        .set({
          name: next.name,
          description: next.description,
          embeddingModel: next.embeddingModel,
          chunkSize: next.chunkSize,
          chunkOverlap: next.chunkOverlap,
          topK: next.topK,
          similarityThreshold: thresholdToStore(next.similarityThreshold),
          hybridSearch: next.hybridSearchEnabled,
          updatedAt: now,
        })
        .where(eq(knowledgeBases.id, id));
      return next;
    },

    async deleteBase(id) {
      const existing = await this.getBase(id);
      if (!existing) return false;
      await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
      return true;
    },

    async getBase(id) {
      const rows = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.id, id))
        .limit(1);
      return rows[0] ? mapBase(rows[0]) : null;
    },

    async listBases(opts?: { ids?: string[]; ownerUserId?: string }) {
      const conditions = [];
      if (opts?.ids?.length) {
        conditions.push(inArray(knowledgeBases.id, opts.ids));
      }
      if (opts?.ownerUserId) {
        conditions.push(eq(knowledgeBases.ownerUserId, opts.ownerUserId));
      }
      const whereClause =
        conditions.length > 1
          ? and(...conditions)
          : conditions.length === 1
            ? conditions[0]
            : undefined;
      let query = db.select().from(knowledgeBases).orderBy(desc(knowledgeBases.updatedAt));
      if (whereClause) {
        query = query.where(whereClause) as typeof query;
      }
      const rows = await query;
      return rows.map(mapBase);
    },

    async createDocument(input) {
      const now = new Date();
      await db.insert(knowledgeDocuments).values({
        id: input.id,
        knowledgeBaseId: input.knowledgeBaseId,
        name: input.name,
        mimeType: input.mimeType,
        storagePath: input.storagePath,
        sizeBytes: input.sizeBytes,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        chunkCount: input.chunkCount ?? 0,
        createdAt: now,
        updatedAt: now,
      });
      return {
        ...input,
        errorMessage: input.errorMessage ?? null,
        chunkCount: input.chunkCount ?? 0,
        createdAt: now,
        updatedAt: now,
      };
    },

    async updateDocument(id, patch) {
      const existing = await this.getDocument(id);
      if (!existing) return null;
      const now = new Date();
      const next = { ...existing, ...patch, updatedAt: now };
      await db
        .update(knowledgeDocuments)
        .set({
          name: next.name,
          storagePath: next.storagePath,
          sizeBytes: next.sizeBytes,
          status: next.status,
          errorMessage: next.errorMessage,
          chunkCount: next.chunkCount,
          updatedAt: now,
        })
        .where(eq(knowledgeDocuments.id, id));
      return next;
    },

    async deleteDocument(id) {
      const existing = await this.getDocument(id);
      if (!existing) return false;
      await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
      return true;
    },

    async getDocument(id) {
      const rows = await db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, id))
        .limit(1);
      return rows[0] ? mapDoc(rows[0]) : null;
    },

    async listDocuments(knowledgeBaseId) {
      const rows = await db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
        .orderBy(desc(knowledgeDocuments.updatedAt));
      return rows.map(mapDoc);
    },

    async deleteChunksForDocument(documentId) {
      await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
    },

    async insertChunks(rows) {
      if (rows.length === 0) return;
      for (const r of rows) {
        const meta = JSON.stringify(r.metadata ?? {});
        const json = JSON.stringify(r.embedding);
        try {
          await pool.query(
            `INSERT INTO knowledge_chunks
              (id, knowledge_base_id, document_id, chunk_index, text, embedding, embedding_json, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)`,
            [
              r.id,
              r.knowledgeBaseId,
              r.documentId,
              r.chunkIndex,
              r.text,
              toVectorLiteral(r.embedding),
              json,
              meta,
            ],
          );
        } catch {
          await pool.query(
            `INSERT INTO knowledge_chunks
              (id, knowledge_base_id, document_id, chunk_index, text, embedding_json, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [r.id, r.knowledgeBaseId, r.documentId, r.chunkIndex, r.text, json, meta],
          );
        }
      }
    },

    async listChunks(knowledgeBaseId, opts) {
      const rows = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.knowledgeBaseId, knowledgeBaseId));
      const filtered = opts?.documentId
        ? rows.filter((r) => r.documentId === opts.documentId)
        : rows;
      const limited = opts?.limit ? filtered.slice(0, opts.limit) : filtered;
      return limited.map((r) => ({
        id: r.id,
        knowledgeBaseId: r.knowledgeBaseId,
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        text: r.text,
        metadata: JSON.parse(r.metadataJson) as Record<string, unknown>,
      }));
    },
  };
}

function mapBase(row: typeof knowledgeBases.$inferSelect): KnowledgeBaseRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerUserId: row.ownerUserId,
    embeddingModel: row.embeddingModel,
    chunkSize: row.chunkSize,
    chunkOverlap: row.chunkOverlap,
    topK: row.topK,
    similarityThreshold: thresholdFromStore(row.similarityThreshold),
    hybridSearchEnabled: row.hybridSearch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDoc(row: typeof knowledgeDocuments.$inferSelect): KnowledgeDocumentRecord {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledgeBaseId,
    name: row.name,
    mimeType: row.mimeType,
    storagePath: row.storagePath,
    sizeBytes: row.sizeBytes,
    status: row.status as KnowledgeDocumentRecord['status'],
    errorMessage: row.errorMessage,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
