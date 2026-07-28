import { and, eq } from 'drizzle-orm';
import type {
  EnvEnvironment,
  EnvRepositoryPort,
  EnvScope,
  EnvUpsertInput,
  EnvVarRecord,
  GlobalEnvSyncInput,
  PlatformEnvUpsertInput,
} from '@rxwf/env';
import {
  globalEnvSyncToUpserts,
  PLATFORM_ENVIRONMENT,
  PLATFORM_ENV_KEYS,
  resolvePlatformEnvMap,
} from '@rxwf/env';
import type { StandardDatabase } from '../drizzle/client.js';
import { envVars as envVarsTable } from '../drizzle/schema.js';

function normalizeScopeId(scope: EnvScope, scopeId?: string | null): string {
  if (scope === 'global') return '';
  return scopeId ?? '';
}

function toRecord(row: typeof envVarsTable.$inferSelect): EnvVarRecord {
  return {
    id: row.id,
    scope: row.scope as EnvScope,
    scopeId: row.scopeId === '' ? null : row.scopeId,
    environment: row.environment as EnvEnvironment,
    key: row.key,
    value: row.value,
    sensitive: row.sensitive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createStandardEnvRepository(db: StandardDatabase): EnvRepositoryPort {
  return {
    async list(filter) {
      const scopeId = normalizeScopeId(filter.scope, filter.scopeId);
      const rows = await db
        .select()
        .from(envVarsTable)
        .where(
          and(
            eq(envVarsTable.scope, filter.scope),
            eq(envVarsTable.scopeId, scopeId),
            eq(envVarsTable.environment, filter.environment),
          ),
        );
      return rows.map(toRecord);
    },

    async listAllGlobal() {
      const rows = await db
        .select()
        .from(envVarsTable)
        .where(eq(envVarsTable.scope, 'global'));
      return rows.map(toRecord);
    },

    async listGlobalForKey(key: string) {
      const rows = await db
        .select()
        .from(envVarsTable)
        .where(and(eq(envVarsTable.scope, 'global'), eq(envVarsTable.key, key)));
      return rows.map(toRecord);
    },

    async listPlatformEnvForKey(key: string) {
      const rows = await db
        .select()
        .from(envVarsTable)
        .where(
          and(
            eq(envVarsTable.scope, 'global'),
            eq(envVarsTable.key, key),
            eq(envVarsTable.environment, PLATFORM_ENVIRONMENT),
          ),
        )
        .limit(1);
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async upsertPlatformEnv(input: PlatformEnvUpsertInput) {
      if (!PLATFORM_ENV_KEYS.has(input.key as never)) {
        throw new Error(`Unknown platform env key: ${input.key}`);
      }
      const [row] = await this.upsertMany([
        {
          scope: 'global',
          scopeId: null,
          environment: PLATFORM_ENVIRONMENT,
          key: input.key,
          value: input.value,
          sensitive: input.sensitive,
        },
      ]);
      return row!;
    },

    async syncGlobalItem(input: GlobalEnvSyncInput) {
      const key = input.key.trim();
      if (!key) return;
      const forKey = await this.listGlobalForKey(key);
      const upserts = globalEnvSyncToUpserts(input);
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

    async upsertMany(items: EnvUpsertInput[]) {
      const out: EnvVarRecord[] = [];
      const now = new Date();
      for (const item of items) {
        const scopeId = normalizeScopeId(item.scope, item.scopeId);
        const existing = await db
          .select()
          .from(envVarsTable)
          .where(
            and(
              eq(envVarsTable.scope, item.scope),
              eq(envVarsTable.scopeId, scopeId),
              eq(envVarsTable.environment, item.environment),
              eq(envVarsTable.key, item.key),
            ),
          )
          .limit(1);
        if (existing[0]) {
          await db
            .update(envVarsTable)
            .set({
              value: item.value,
              sensitive: item.sensitive ?? false,
              updatedAt: now,
            })
            .where(eq(envVarsTable.id, existing[0].id));
          const updated = await db
            .select()
            .from(envVarsTable)
            .where(eq(envVarsTable.id, existing[0].id))
            .limit(1);
          if (updated[0]) out.push(toRecord(updated[0]));
        } else {
          const id = crypto.randomUUID();
          await db.insert(envVarsTable).values({
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
            .from(envVarsTable)
            .where(eq(envVarsTable.id, id))
            .limit(1);
          if (inserted[0]) out.push(toRecord(inserted[0]));
        }
      }
      return out;
    },

    async deleteById(id) {
      await db.delete(envVarsTable).where(eq(envVarsTable.id, id));
    },

    async loadLayers() {
      return {
        global: await resolvePlatformEnvMap(this),
        user: {},
        workflow: {},
      };
    },
  };
}
