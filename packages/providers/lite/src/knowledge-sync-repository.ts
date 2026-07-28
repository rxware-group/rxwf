import { eq } from 'drizzle-orm';
import type {
  KnowledgeSyncRepository,
  KnowledgeSyncSourceRecord,
} from '@rxwf/providers-contracts';
import type { LiteDatabase } from './db.js';
import { knowledgeSyncSources } from './drizzle/schema.js';

export function createLiteKnowledgeSyncRepository(db: LiteDatabase): KnowledgeSyncRepository {
  return {
    async createSyncSource(input) {
      const now = new Date();
      await db.insert(knowledgeSyncSources).values({
        id: input.id,
        knowledgeBaseId: input.knowledgeBaseId,
        kind: input.kind,
        configJson: JSON.stringify(input.config),
        enabled: input.enabled,
        lastSyncAt: input.lastSyncAt ?? null,
        lastError: input.lastError ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return {
        ...input,
        lastSyncAt: input.lastSyncAt ?? null,
        lastError: input.lastError ?? null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async updateSyncSource(id, patch) {
      const existing = await this.getSyncSource(id);
      if (!existing) return null;
      const now = new Date();
      const next = {
        ...existing,
        ...patch,
        config: patch.config ?? existing.config,
        updatedAt: now,
      };
      await db
        .update(knowledgeSyncSources)
        .set({
          enabled: next.enabled,
          configJson: JSON.stringify(next.config),
          lastSyncAt: next.lastSyncAt,
          lastError: next.lastError,
          updatedAt: now,
        })
        .where(eq(knowledgeSyncSources.id, id));
      return next;
    },

    async deleteSyncSource(id) {
      const existing = await this.getSyncSource(id);
      if (!existing) return false;
      await db.delete(knowledgeSyncSources).where(eq(knowledgeSyncSources.id, id));
      return true;
    },

    async getSyncSource(id) {
      const rows = await db
        .select()
        .from(knowledgeSyncSources)
        .where(eq(knowledgeSyncSources.id, id))
        .limit(1);
      return rows[0] ? mapSync(rows[0]) : null;
    },

    async listSyncSources(knowledgeBaseId) {
      const rows = await db
        .select()
        .from(knowledgeSyncSources)
        .where(eq(knowledgeSyncSources.knowledgeBaseId, knowledgeBaseId));
      return rows.map(mapSync);
    },

    async listEnabledSyncSources() {
      const rows = await db.select().from(knowledgeSyncSources);
      return rows.filter((r) => r.enabled).map(mapSync);
    },
  };
}

function mapSync(row: typeof knowledgeSyncSources.$inferSelect): KnowledgeSyncSourceRecord {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledgeBaseId,
    kind: row.kind as KnowledgeSyncSourceRecord['kind'],
    config: JSON.parse(row.configJson) as { path: string },
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
