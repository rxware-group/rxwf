import { describe, expect, it } from 'vitest';
import { listDownstreamIdsInTopologicalOrder } from './list-downstream-ids.js';

describe('listDownstreamIdsInTopologicalOrder', () => {
  it('returns downstream nodes in topological order', () => {
    const edges = [
      { from: 'if1', to: 'a' },
      { from: 'if1', to: 'b' },
      { from: 'a', to: 'c' },
    ];
    expect(listDownstreamIdsInTopologicalOrder(edges, ['if1'])).toEqual([
      'a',
      'c',
      'b',
    ]);
  });
});
