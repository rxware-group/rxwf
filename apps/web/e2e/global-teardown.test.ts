import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teardownCompose } from './global-teardown.js';

describe('teardownCompose', () => {
  it('fails when rxwf-e2e containers still exist after down', async () => {
    const calls: string[][] = [];
    const execFn = async (_file: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'down') {
        return '';
      }
      if (args[0] === 'ps' && args.includes('-q')) {
        return 'leaked-rxwf-e2e-container\n';
      }
      return '';
    };

    await assert.rejects(
      () => teardownCompose({ track: 'standard', execFn }),
      /containers still exist/i,
    );

    assert.ok(
      calls.some((args) => args[0] === 'down' && args.includes('-v')),
    );
  });

  it('passes when no containers remain after down', async () => {
    const execFn = async (_file: string, args: string[]) => {
      if (args[0] === 'down') {
        return '';
      }
      if (args[0] === 'ps') {
        return '\n';
      }
      return '';
    };

    await teardownCompose({ track: 'plus', execFn });
  });

  it('skips compose down for lite track', async () => {
    const execFn = async () => {
      throw new Error('docker should not run for lite track');
    };

    await teardownCompose({ track: 'lite', execFn });
  });
});
