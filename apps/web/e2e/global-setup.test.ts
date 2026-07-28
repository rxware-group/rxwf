import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  buildE2eEnvLines,
  resolveE2eTrack,
  runGlobalSetup,
} from './global-setup.ts';

describe('resolveE2eTrack', () => {
  it('returns standard and plus when set', () => {
    assert.equal(resolveE2eTrack({ RXWF_E2E_TRACK: 'standard' }), 'standard');
    assert.equal(resolveE2eTrack({ RXWF_E2E_TRACK: 'PLUS' }), 'plus');
  });

  it('defaults to lite for missing or unknown track', () => {
    assert.equal(resolveE2eTrack({}), 'lite');
    assert.equal(resolveE2eTrack({ RXWF_E2E_TRACK: 'unknown' }), 'lite');
  });
});

describe('runGlobalSetup', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'rxwf-global-setup-'));
    const authDir = path.join(tempDir, '.auth');
    await mkdir(authDir, { recursive: true });
    await writeFile(path.join(authDir, 'user.json'), '{}', 'utf8');
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('calls compose up when track is standard', async () => {
    let composeUpTrack: string | undefined;
    const cmdUpFn = async (track: string) => {
      composeUpTrack = track;
      return 0;
    };

    await runGlobalSetup({
      e2eDir: tempDir,
      env: {
        RXWF_E2E_TRACK: 'standard',
        RXWF_POSTGRES_PASSWORD: 'pg-pass',
        RXWF_REDIS_PASSWORD: 'redis-pass',
      },
      cmdUpFn,
    });

    assert.equal(composeUpTrack, 'standard');
  });

  it('skips compose up for lite track', async () => {
    let composeUpCalled = false;
    const cmdUpFn = async () => {
      composeUpCalled = true;
      return 0;
    };

    await runGlobalSetup({
      e2eDir: tempDir,
      env: { RXWF_E2E_TRACK: 'lite' },
      cmdUpFn,
    });

    assert.equal(composeUpCalled, false);
  });

  it('writes .e2e-env for standard track with database urls', async () => {
    await runGlobalSetup({
      e2eDir: tempDir,
      env: {
        RXWF_E2E_TRACK: 'standard',
        RXWF_POSTGRES_PASSWORD: 'pg-pass',
        RXWF_REDIS_PASSWORD: 'redis-pass',
      },
      cmdUpFn: async () => 0,
    });

    const content = await readFile(path.join(tempDir, '.e2e-env'), 'utf8');
    assert.match(content, /^RXWF_E2E_TRACK=standard$/m);
    assert.match(content, /^RXWF_DATABASE_URL=postgres:\/\//m);
    assert.match(content, /^RXWF_REDIS_URL=redis:\/\//m);
  });

  it('clears auth directory before setup', async () => {
    const authFile = path.join(tempDir, '.auth', 'user.json');
    assert.ok(await readFile(authFile, 'utf8'));

    await runGlobalSetup({
      e2eDir: tempDir,
      env: { RXWF_E2E_TRACK: 'lite' },
      cmdUpFn: async () => 0,
    });

    await assert.rejects(() => readFile(authFile, 'utf8'));
  });
});

describe('buildE2eEnvLines', () => {
  it('includes crewai runner url for plus track', () => {
    const lines = buildE2eEnvLines('plus', {
      RXWF_POSTGRES_PASSWORD: 'pg-pass',
      RXWF_REDIS_PASSWORD: 'redis-pass',
    });
    assert.ok(lines.some((line) => line.startsWith('CREWAI_RUNNER_URL=')));
  });
});
