import { describe, it, expect } from 'vitest';
import { ensureUniqueNodeName, findDuplicateNodeName } from './unique-node-name.js';

describe('ensureUniqueNodeName', () => {
  it('returns base when unused', () => {
    expect(ensureUniqueNodeName(['A'], 'Set')).toBe('Set');
  });

  it('appends numeric suffix when base taken', () => {
    expect(ensureUniqueNodeName(['Set', 'Set 2'], 'Set')).toBe('Set 3');
  });
});

describe('findDuplicateNodeName', () => {
  it('detects duplicate among executable nodes', () => {
    const nodes = [
      { id: '1', type: 'set', name: 'X' },
      { id: '2', type: 'set', name: 'X' },
    ];
    expect(findDuplicateNodeName(nodes, '2')).toBe('X');
  });
});
