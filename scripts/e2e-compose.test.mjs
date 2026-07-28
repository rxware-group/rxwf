import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TRACK_COMPOSE_FILES,
  assertNoContainers,
  parsePsJson,
  resolveTrack,
  waitForHealth,
  cmdUp,
} from './e2e-compose.mjs';

describe('resolveTrack', () => {
  it('maps standard and plus to compose files', () => {
    assert.equal(resolveTrack('standard'), TRACK_COMPOSE_FILES.standard);
    assert.equal(resolveTrack('plus'), TRACK_COMPOSE_FILES.plus);
  });

  it('rejects unknown track', () => {
    assert.throws(() => resolveTrack('lite'), /unknown track/i);
  });
});

describe('parsePsJson', () => {
  it('parses NDJSON service rows', () => {
    const rows = parsePsJson(
      '{"Service":"postgres","Health":"healthy","State":"running"}\n{"Service":"redis","Health":"healthy","State":"running"}\n',
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].Service, 'postgres');
  });
});

describe('waitForHealth', () => {
  it('fails when healthcheck times out before services are ready', async () => {
    let calls = 0;
    let clock = 0;
    const execFn = async () => {
      calls += 1;
      return '{"Service":"postgres","Health":"starting","State":"running"}\n';
    };

    await assert.rejects(
      () =>
        waitForHealth({
          composeFile: TRACK_COMPOSE_FILES.standard,
          timeoutMs: 50,
          intervalMs: 10,
          execFn,
          now: () => {
            clock += 20;
            return clock;
          },
          sleep: async () => {},
        }),
      /healthcheck timeout/i,
    );
    assert.ok(calls > 0);
  });

  it('succeeds when all running services report healthy', async () => {
    const execFn = async () =>
      '{"Service":"postgres","Health":"healthy","State":"running"}\n{"Service":"redis","Health":"healthy","State":"running"}\n';

    await waitForHealth({
      composeFile: TRACK_COMPOSE_FILES.standard,
      timeoutMs: 1000,
      intervalMs: 10,
      execFn,
      sleep: async () => {},
    });
  });
});

describe('assertNoContainers', () => {
  it('fails when containers still exist after down', async () => {
    const execFn = async (_file, args) => {
      if (args[0] === 'ps') {
        return 'abc123def456\n';
      }
      return '';
    };

    await assert.rejects(
      () =>
        assertNoContainers({
          composeFile: TRACK_COMPOSE_FILES.standard,
          execFn,
        }),
      /containers still exist/i,
    );
  });

  it('passes when no containers remain', async () => {
    const execFn = async (_file, args) => {
      if (args[0] === 'ps') {
        return '\n';
      }
      return '';
    };

    await assertNoContainers({
      composeFile: TRACK_COMPOSE_FILES.standard,
      execFn,
    });
  });
});

describe('cmdUp dry-run', () => {
  it('prints compose up without executing docker', async () => {
    const logs = [];
    const execFn = async () => {
      throw new Error('docker should not run in dry-run');
    };

    const code = await cmdUp('standard', {
      dryRun: true,
      noWait: true,
      execFn,
      log: (msg) => logs.push(msg),
    });

    assert.equal(code, 0);
    assert.ok(logs.some((line) => /docker compose.*up -d/i.test(line)));
    assert.ok(logs.some((line) => line.includes(TRACK_COMPOSE_FILES.standard)));
  });
});
