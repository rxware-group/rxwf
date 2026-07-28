import { describe, expect, it } from 'vitest';
import { recordsToMap, resolveEnvLayers } from './resolve.js';

describe('resolveEnvLayers', () => {
  it('workflow overrides user and global (AC-6)', () => {
    const map = resolveEnvLayers({
      global: { FOO: 'g' },
      user: { FOO: 'u' },
      workflow: { FOO: 'w' },
    });
    expect(map.FOO).toBe('w');
  });

  it('merges distinct keys from all layers', () => {
    const map = resolveEnvLayers({
      global: { A: '1' },
      user: { B: '2' },
      workflow: { C: '3' },
    });
    expect(map).toEqual({ A: '1', B: '2', C: '3' });
  });
});

describe('recordsToMap', () => {
  it('maps key to value', () => {
    expect(
      recordsToMap([
        { key: 'X', value: '1' },
        { key: 'Y', value: '2' },
      ]),
    ).toEqual({ X: '1', Y: '2' });
  });
});
