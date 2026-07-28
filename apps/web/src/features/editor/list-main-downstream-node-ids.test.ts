import { describe, expect, it } from 'vitest';
import { listMainDownstreamNodeIds } from './list-main-downstream-node-ids.js';

describe('listMainDownstreamNodeIds', () => {
  const definition = {
    schemaVersion: 1 as const,
    name: 'w',
    nodes: [
      { id: 'a', type: 'manualTrigger', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'b', type: 'set', name: 'B', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'c', type: 'if', name: 'C', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'd', type: 'code', name: 'D', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'e', type: 'stickyNote', name: 'E', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'f', type: 'set', name: 'F', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd', fromOutput: 'true' },
      { from: 'c', to: 'f', fromOutput: 'ai_tool' },
      { from: 'd', to: 'e' },
    ],
  };

  it('lists only main-data downstream nodes in traversal order', () => {
    expect(listMainDownstreamNodeIds(definition, 'b')).toEqual(['c', 'd']);
  });

  it('returns empty when source has no main downstream', () => {
    expect(listMainDownstreamNodeIds(definition, 'f')).toEqual([]);
  });
});
