import { describe, expect, it } from 'vitest';

import type { RunnerExtensionManifest } from './manifest.js';
import { validateExtensionManifest } from './validate-manifest.js';

const baseManifest: RunnerExtensionManifest = {
  id: '@acme/rxwf-wmi-executor',
  version: '1.0.0',
  runnerSdk: '^1.0.0',
};

describe('validateExtensionManifest', () => {
  it('passes when manifest runnerSdk major matches sdk version', () => {
    const result = validateExtensionManifest(baseManifest, '1.0.0');
    expect(result).toEqual({ ok: true });
  });

  it('fails when manifest runnerSdk major differs from sdk version', () => {
    const result = validateExtensionManifest(baseManifest, '2.0.0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('incompatible');
    }
  });

  it('fails when runnerSdk is missing', () => {
    const manifest = { ...baseManifest, runnerSdk: '' };
    const result = validateExtensionManifest(manifest, '1.0.0');
    expect(result).toEqual({ ok: false, reason: 'manifest.runnerSdk is required' });
  });
});
