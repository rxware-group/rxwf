import { describe, it, expect } from 'vitest';
import type { EnvRepositoryPort, EnvVarRecord } from './types.js';
import { PLATFORM_ENVIRONMENT } from './platform-env-catalog.js';
import { migratePlatformEnv, listPlatformEnvItems, PLATFORM_ENV_KEYS } from './index.js';

function createMemoryEnvRepo(): EnvRepositoryPort {
  const rows = new Map<string, EnvVarRecord>();

  return {
    async list() {
      return [];
    },
    async listAllGlobal() {
      return [...rows.values()];
    },
    async listGlobalForKey(key) {
      return [...rows.values()].filter((r) => r.key === key);
    },
    async listPlatformEnvForKey(key) {
      const row = [...rows.values()].find(
        (r) => r.key === key && r.environment === PLATFORM_ENVIRONMENT,
      );
      return row ?? null;
    },
    async upsertPlatformEnv(input) {
      const id = crypto.randomUUID();
      const now = new Date();
      const existing = [...rows.values()].find(
        (r) =>
          r.scope === 'global' &&
          r.key === input.key &&
          r.environment === PLATFORM_ENVIRONMENT,
      );
      const record: EnvVarRecord = {
        id: existing?.id ?? id,
        scope: 'global',
        scopeId: null,
        environment: PLATFORM_ENVIRONMENT,
        key: input.key,
        value: input.value,
        sensitive: input.sensitive,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rows.set(record.id, record);
      return record;
    },
    async syncGlobalItem() {},
    async upsertMany() {
      return [];
    },
    async deleteById(id) {
      rows.delete(id);
    },
    async loadLayers() {
      return { global: {}, user: {}, workflow: {} };
    },
  };
}

describe('migratePlatformEnv', () => {
  it('seeds whitelist keys in runtime environment', async () => {
    const repo = createMemoryEnvRepo();
    await migratePlatformEnv(repo);
    const items = await listPlatformEnvItems(repo, { maskSensitive: false });
    expect(items).toHaveLength(PLATFORM_ENV_KEYS.size);
    expect(items.every((i) => i.key.startsWith('RXWF_'))).toBe(true);
    expect(items.find((i) => i.key === 'RXWF_PUBLIC_URL')?.value).toContain('http');
  });
});
