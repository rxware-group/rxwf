import { and, eq } from 'drizzle-orm';
import type {
  VarEnvironment,
  VariablesRepositoryPort,
  VarScope,
  VarUpsertInput,
  VarRecord,
  GlobalVarSyncInput,
} from '@rxwf/variables';
import { globalVarSyncToUpserts, recordsToMap } from '@rxwf/variables';
import type { LiteDatabase } from './db.js';
import { variables as variablesTable } from './drizzle/schema.js';

function normalizeScopeId(scope: VarScope, scopeId?: string | null): string {
  if (scope === 'global') return '';
  return scopeId ?? '';
}

function toRecord(row: typeof variablesTable.$inferSelect): VarRecord {
  return {
    id: row.id,
    scope: row.scope as VarScope,
    scopeId: row.scopeId === '' ? null : row.scopeId,
    environment: row.environment as VarEnvironment,
    key: row.key,
    value: row.value,
    sensitive: row.sensitive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createLiteVariablesRepository(db: LiteDatabase): VariablesRepositoryPort {
  return {
    async list(filter) {
      const scopeId = normalizeScopeId(filter.scope, filter.scopeId);
      const rows = await db
        .select()
        .from(variablesTable)
        .where(
          and(
            eq(variablesTable.scope, filter.scope),
            eq(variablesTable.scopeId, scopeId),
            eq(variablesTable.environment, filter.environment),
          ),
        );
      return rows.map(toRecord);
    },

    async listAllGlobal() {
      const rows = await db
        .select()
        .from(variablesTable)
        .where(eq(variablesTable.scope, 'global'));
      return rows.map(toRecord);
    },

    async listGlobalForKey(key: string) {
      const rows = await db
        .select()
        .from(variablesTable)
        .where(and(eq(variablesTable.scope, 'global'), eq(variablesTable.key, key)));
      return rows.map(toRecord);
    },

    async syncGlobalItem(input: GlobalVarSyncInput) {
      const key = input.key.trim();
      if (!key) return;
      const forKey = await this.listGlobalForKey(key);
      const upserts = globalVarSyncToUpserts(input);
      for (const row of forKey) {
        const stillNeeded = upserts.some((u) => u.environment === row.environment);
        if (!stillNeeded) {
          await this.deleteById(row.id);
        }
      }
      if (upserts.length > 0) {
        await this.upsertMany(
          upserts.map((u) => ({
            scope: 'global',
            scopeId: null,
            environment: u.environment,
            key: u.key,
            value: u.value,
            sensitive: u.sensitive,
          })),
        );
      }
    },

    async upsertMany(items) {
      const out: VarRecord[] = [];
      const now = new Date();
      for (const item of items) {
        const scopeId = normalizeScopeId(item.scope, item.scopeId);
        const existing = await db
          .select()
          .from(variablesTable)
          .where(
            and(
              eq(variablesTable.scope, item.scope),
              eq(variablesTable.scopeId, scopeId),
              eq(variablesTable.environment, item.environment),
              eq(variablesTable.key, item.key),
            ),
          )
          .limit(1);
        if (existing[0]) {
          await db
            .update(variablesTable)
            .set({
              value: item.value,
              sensitive: item.sensitive ?? false,
              updatedAt: now,
            })
            .where(eq(variablesTable.id, existing[0].id));
          const updated = await db
            .select()
            .from(variablesTable)
            .where(eq(variablesTable.id, existing[0].id))
            .limit(1);
          if (updated[0]) out.push(toRecord(updated[0]));
        } else {
          const id = crypto.randomUUID();
          await db.insert(variablesTable).values({
            id,
            scope: item.scope,
            scopeId,
            environment: item.environment,
            key: item.key,
            value: item.value,
            sensitive: item.sensitive ?? false,
            createdAt: now,
            updatedAt: now,
          });
          const inserted = await db
            .select()
            .from(variablesTable)
            .where(eq(variablesTable.id, id))
            .limit(1);
          if (inserted[0]) out.push(toRecord(inserted[0]));
        }
      }
      return out;
    },

    async deleteById(id) {
      await db.delete(variablesTable).where(eq(variablesTable.id, id));
    },

    async loadLayers(input) {
      const global = await this.list({
        scope: 'global',
        environment: input.environment,
      });
      return {
        global: recordsToMap(global),
        user: {},
        workflow: {},
      };
    },
  };
}
