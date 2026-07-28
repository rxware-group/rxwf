import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { createLiteEnvRepository } from '@rxwf/providers-lite';
import { createSystemSettingsService } from '@rxwf/system-settings';
import { parseCredentialKey } from '@rxwf/credential';
import { config } from '../config.js';
import { ensurePlatformEnv } from './ensure-platform-env.js';

describe('ensurePlatformEnv', () => {
  it('seeds RXWF_SANDBOX_CODE_TIMEOUT_MS when missing', async () => {
    const db = await createTestDb();
    const repo = createLiteEnvRepository(db);
    const settings = createSystemSettingsService(
      db,
      parseCredentialKey(config.credentialKey),
    );
    await ensurePlatformEnv(repo, settings);
    const row = await repo.listPlatformEnvForKey('RXWF_SANDBOX_CODE_TIMEOUT_MS');
    expect(row?.value).toBe('-1');
    expect(row?.environment).toBe('runtime');
  });

  it('does not overwrite existing platform env value', async () => {
    const db = await createTestDb();
    const repo = createLiteEnvRepository(db);
    await repo.upsertPlatformEnv({
      key: 'RXWF_SANDBOX_CODE_TIMEOUT_MS',
      value: '30000',
      sensitive: false,
    });
    await ensurePlatformEnv(repo);
    const row = await repo.listPlatformEnvForKey('RXWF_SANDBOX_CODE_TIMEOUT_MS');
    expect(row?.value).toBe('30000');
  });
});
