import { and, eq } from 'drizzle-orm';
import type {
  ModelCatalogRepository,
  ModelProviderRecord,
  ModelRecord,
} from '@rxwf/model-catalog';
import type { LiteDatabase } from './db.js';
import { modelProviders, models } from './drizzle/schema.js';

export type LiteModelCatalogRepository = ModelCatalogRepository;

export function createLiteModelCatalogRepository(
  db: LiteDatabase,
): LiteModelCatalogRepository {
  return {
    async listProviders() {
      const rows = await db.select().from(modelProviders);
      return rows.map(mapProvider);
    },

    async createProvider(input) {
      const now = new Date();
      await db.insert(modelProviders).values({
        id: input.id,
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl,
        credentialId: input.credentialId,
        enabled: input.enabled,
        healthStatus: 'unknown',
        lastHealthAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return mapProvider({
        id: input.id,
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl,
        credentialId: input.credentialId,
        enabled: input.enabled,
        healthStatus: 'unknown',
        lastHealthAt: null,
        createdAt: now,
        updatedAt: now,
      });
    },

    async updateProvider(id, patch) {
      const existing = await db
        .select()
        .from(modelProviders)
        .where(eq(modelProviders.id, id))
        .limit(1);
      if (!existing[0]) return null;
      const now = new Date();
      const next = {
        name: patch.name ?? existing[0].name,
        kind: patch.kind ?? existing[0].kind,
        baseUrl: patch.baseUrl ?? existing[0].baseUrl,
        credentialId:
          patch.credentialId !== undefined
            ? patch.credentialId
            : existing[0].credentialId,
        enabled: patch.enabled ?? existing[0].enabled,
      };
      await db
        .update(modelProviders)
        .set({ ...next, updatedAt: now })
        .where(eq(modelProviders.id, id));
      return mapProvider({ ...existing[0], ...next, updatedAt: now });
    },

    async updateProviderHealth(id, healthStatus) {
      const existing = await db
        .select()
        .from(modelProviders)
        .where(eq(modelProviders.id, id))
        .limit(1);
      if (!existing[0]) return null;
      const now = new Date();
      await db
        .update(modelProviders)
        .set({
          healthStatus,
          lastHealthAt: now,
          updatedAt: now,
        })
        .where(eq(modelProviders.id, id));
      return mapProvider({
        ...existing[0],
        healthStatus,
        lastHealthAt: now,
        updatedAt: now,
      });
    },

    async listModels(filter) {
      const rows = await db.select().from(models);
      const mapped = rows.map(mapModel);
      if (!filter?.capability) return mapped;
      return mapped.filter((m) => m.capabilities.includes(filter.capability!));
    },

    async findModelById(id) {
      const rows = await db
        .select()
        .from(models)
        .where(eq(models.id, id))
        .limit(1);
      return rows[0] ? mapModel(rows[0]) : null;
    },

    async findProviderById(id) {
      const rows = await db
        .select()
        .from(modelProviders)
        .where(eq(modelProviders.id, id))
        .limit(1);
      return rows[0] ? mapProvider(rows[0]) : null;
    },

    async upsertDiscoveredModels(providerId, discovered) {
      const now = new Date();
      for (const item of discovered) {
        const existing = await db
          .select()
          .from(models)
          .where(
            and(
              eq(models.providerId, providerId),
              eq(models.modelName, item.modelName),
            ),
          )
          .limit(1);
        if (existing[0]) {
          if (existing[0].source === 'manual') continue;
          await db
            .update(models)
            .set({
              capabilities: JSON.stringify(item.capabilities),
              updatedAt: now,
            })
            .where(eq(models.id, existing[0].id));
          continue;
        }
        await db.insert(models).values({
          id: crypto.randomUUID(),
          providerId,
          modelName: item.modelName,
          capabilities: JSON.stringify(item.capabilities),
          isDefaultChat: false,
          isDefaultWorkflow: false,
          enabled: true,
          source: 'discovered',
          createdAt: now,
          updatedAt: now,
        });
      }
    },

    async setDefaultChatModel(modelId) {
      await db.update(models).set({ isDefaultChat: false });
      await db
        .update(models)
        .set({ isDefaultChat: true, updatedAt: new Date() })
        .where(eq(models.id, modelId));
    },

    async setDefaultWorkflowModel(modelId) {
      await db.update(models).set({ isDefaultWorkflow: false });
      await db
        .update(models)
        .set({ isDefaultWorkflow: true, updatedAt: new Date() })
        .where(eq(models.id, modelId));
    },

    async addModel(input) {
      const now = new Date();
      await db.insert(models).values({
        id: input.id,
        providerId: input.providerId,
        modelName: input.modelName,
        capabilities: JSON.stringify(input.capabilities),
        isDefaultChat: input.isDefaultChat,
        isDefaultWorkflow: input.isDefaultWorkflow,
        enabled: input.enabled,
        source: input.source,
        createdAt: now,
        updatedAt: now,
      });
      return {
        ...input,
        createdAt: now,
        updatedAt: now,
      };
    },

    async updateModel(id, patch) {
      const existing = await db
        .select()
        .from(models)
        .where(eq(models.id, id))
        .limit(1);
      if (!existing[0]) return null;
      const now = new Date();
      const next = {
        enabled: patch.enabled ?? existing[0].enabled,
        isDefaultChat: patch.isDefaultChat ?? existing[0].isDefaultChat,
        isDefaultWorkflow: patch.isDefaultWorkflow ?? existing[0].isDefaultWorkflow,
      };
      await db
        .update(models)
        .set({ ...next, updatedAt: now })
        .where(eq(models.id, id));
      return mapModel({ ...existing[0], ...next, updatedAt: now });
    },
  };
}

function mapProvider(
  row: typeof modelProviders.$inferSelect,
): ModelProviderRecord {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ModelProviderRecord['kind'],
    baseUrl: row.baseUrl,
    credentialId: row.credentialId,
    enabled: row.enabled,
    healthStatus: row.healthStatus as ModelProviderRecord['healthStatus'],
    lastHealthAt: row.lastHealthAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapModel(row: typeof models.$inferSelect): ModelRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    modelName: row.modelName,
    capabilities: JSON.parse(row.capabilities) as string[],
    isDefaultChat: row.isDefaultChat,
    isDefaultWorkflow: row.isDefaultWorkflow,
    enabled: row.enabled,
    source: row.source as ModelRecord['source'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
