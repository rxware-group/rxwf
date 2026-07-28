import { describe, it, expect } from 'vitest';
import { listPredecessorNodes } from './predecessor-nodes.js';

describe('listPredecessorNodes', () => {
  it('returns ancestors in topological order excluding target', () => {
    const def = {
      schemaVersion: 1 as const,
      name: 'w',
      nodes: [
        {
          id: 't',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        { id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'b', type: 'set', name: 'B', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 't', to: 'a' },
        { from: 'a', to: 'b' },
      ],
    };
    expect(listPredecessorNodes(def, 'b').map((n) => n.name)).toEqual(['T', 'A']);
  });
});
