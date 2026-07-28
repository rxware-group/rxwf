import { describe, it, expect } from 'vitest';
import {
  getPlatformEnvCatalogEntry,
  PLATFORM_ENV_CATALOG,
  PLATFORM_ENV_KEYS,
} from './platform-env-catalog.js';

describe('platform-env-catalog', () => {
  it('all keys use RXWF_ prefix', () => {
    for (const entry of PLATFORM_ENV_CATALOG) {
      expect(entry.key.startsWith('RXWF_')).toBe(true);
      expect(PLATFORM_ENV_KEYS.has(entry.key)).toBe(true);
    }
  });

  it('validates RXWF_PUBLIC_URL', () => {
    const entry = getPlatformEnvCatalogEntry('RXWF_PUBLIC_URL')!;
    expect(entry.validate('http://localhost:8787')).toBeNull();
    expect(entry.validate('not-a-url')).toBeTruthy();
  });

  it('validates RXWF_SANDBOX_CODE_TIMEOUT_MS allows -1', () => {
    const entry = getPlatformEnvCatalogEntry('RXWF_SANDBOX_CODE_TIMEOUT_MS')!;
    expect(entry.validate('-1')).toBeNull();
    expect(entry.validate('1000')).toBeNull();
  });
});
