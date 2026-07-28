import { describe, expect, it } from 'vitest';
import {
  normalizeExecuteCommandArgs,
  resolveExecuteCommandArgv,
} from './execute-command-args.js';

describe('resolveExecuteCommandArgv', () => {
  it('uses argv mode when args array is non-empty', () => {
    expect(
      resolveExecuteCommandArgv({ command: 'echo', args: ['rxwf'] }),
    ).toEqual({
      command: 'echo',
      argv: ['rxwf'],
      legacyShellLine: false,
    });
  });

  it('keeps legacy shell line only when args key is absent', () => {
    expect(resolveExecuteCommandArgv({ command: 'echo rxwf' })).toEqual({
      command: 'echo rxwf',
      argv: [],
      legacyShellLine: true,
    });
    expect(resolveExecuteCommandArgv({ command: 'echo', args: [] })).toEqual({
      command: 'echo',
      argv: [],
      legacyShellLine: false,
    });
  });

  it('drops empty argv entries', () => {
    expect(normalizeExecuteCommandArgs(['--help', '', '  '])).toEqual(['--help']);
    expect(normalizeExecuteCommandArgs(['say "hello"'])).toEqual(['say "hello"']);
  });
});
