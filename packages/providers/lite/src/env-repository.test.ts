import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db.js';
import { createLiteEnvRepository } from './env-repository.js';

describe('createLiteEnvRepository', () => {
  it('upserts global test env var', async () => {
    const db = await createTestDb();
    const repo = createLiteEnvRepository(db);
    await repo.syncGlobalItem({
      key: 'FOO',
      value: 'bar',
      testEnabled: true,
      prodEnabled: false,
    });
    const items = await repo.list({ scope: 'global', environment: 'test' });
    expect(items).toHaveLength(1);
    expect(items[0]?.key).toBe('FOO');
    expect(items[0]?.value).toBe('bar');
  });

  it('loadLayers returns platform whitelist global only', async () => {
    const db = await createTestDb();
    const repo = createLiteEnvRepository(db);
    await repo.upsertPlatformEnv({
      key: 'RXWF_PUBLIC_URL',
      value: 'https://example.test',
      sensitive: false,
    });
    const layers = await repo.loadLayers({
      workflowId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      environment: 'prod',
    });
    expect(layers.global.RXWF_PUBLIC_URL).toBe('https://example.test');
    expect(layers.user).toEqual({});
    expect(layers.workflow).toEqual({});
  });

  it('syncGlobalItem writes same value to test and prod', async () => {
    const db = await createTestDb();
    const repo = createLiteEnvRepository(db);
    await repo.syncGlobalItem({
      key: 'X',
      value: 'shared',
      testEnabled: true,
      prodEnabled: true,
    });
    const testRows = await repo.list({ scope: 'global', environment: 'test' });
    const prodRows = await repo.list({ scope: 'global', environment: 'prod' });
    expect(testRows[0]?.value).toBe('shared');
    expect(prodRows[0]?.value).toBe('shared');
  });
});
