import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadRunnerConfig } from './config.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = join(packageRoot, 'rxwf-runner.json.example');

describe('loadRunnerConfig', () => {
  it('loads the example config', () => {
    const config = loadRunnerConfig(examplePath);

    expect(config).toEqual({
      serverUrl: 'https://rxwf.example.com',
      runnerId: 'uuid',
      credentialFile: '/etc/rxwf-runner/credential',
      name: 'win-build-01',
      maxConcurrent: 4,
      extensions: [
        '@rxwf/runner-builtin-plus',
        '@acme/rxwf-wmi-executor',
        './plugins/custom.js',
      ],
      labels: ['ci', 'windows'],
      crewaiSidecarUrl: 'http://127.0.0.1:8071',
      logLevel: 'info',
      shutdownTimeoutMs: 120000,
    });
  });

  it('throws when serverUrl is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rxwf-runner-config-'));
    const configPath = join(dir, 'rxwf-runner.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        credentialFile: '/etc/rxwf-runner/credential',
        name: 'test-runner',
      }),
    );

    expect(() => loadRunnerConfig(configPath)).toThrow('serverUrl is required');
  });
});
