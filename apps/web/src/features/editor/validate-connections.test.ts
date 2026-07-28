import { describe, it, expect } from 'vitest';
import { validateConnections } from './validate-connections.js';

describe('validateConnections', () => {
  it('detects cycle (AC-1)', () => {
    const errors = validateConnections({
      schemaVersion: 1,
      name: 'c',
      nodes: [
        { id: 'a', type: 'set', name: 'a', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'b', type: 'set', name: 'b', position: { x: 1, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('allows loop body feedback to loop node', () => {
    const errors = validateConnections({
      schemaVersion: 1,
      name: 'loop-flow',
      nodes: [
        { id: 'manual', type: 'manualTrigger', name: 'Manual', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'loop', type: 'loop', name: 'Loop', position: { x: 1, y: 0 }, parameters: {} },
        { id: 'cmd', type: 'executeCommand', name: 'Cmd', position: { x: 2, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'manual', to: 'loop' },
        { from: 'loop', to: 'cmd', fromOutput: '0' },
        { from: 'cmd', to: 'loop' },
      ],
    });
    expect(errors).toEqual([]);
  });
});
