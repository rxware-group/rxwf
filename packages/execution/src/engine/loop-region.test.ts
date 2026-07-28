import { describe, it, expect } from 'vitest';
import { computeLoopRegion } from './loop-region.js';

describe('computeLoopRegion', () => {
  const edges = [
    { from: 'loop', to: 'a', outputIndex: 0 },
    { from: 'a', to: 'b' },
    { from: 'loop', to: 'done', outputIndex: 1 },
    { from: 'b', to: 'done' },
  ];

  it('identifies body nodes excluding done branch', () => {
    const region = computeLoopRegion('loop', edges);
    expect([...region.bodyNodeIds].sort()).toEqual(['a', 'b']);
    expect(region.bodyEntryIds).toEqual(['a']);
    expect(region.bodyExitIds).toContain('b');
  });

  it('returns empty body when only done branch connected', () => {
    const region = computeLoopRegion('loop', [
      { from: 'loop', to: 'done', outputIndex: 1 },
    ]);
    expect(region.bodyNodeIds.size).toBe(0);
    expect(region.bodyEntryIds).toEqual([]);
  });
});
