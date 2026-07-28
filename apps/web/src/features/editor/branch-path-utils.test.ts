import { describe, expect, it } from 'vitest';
import { firstEdgeOnPathToTarget, itemsOnPathBranch } from './branch-path-utils.js';

const ifDef = {
  schemaVersion: 1 as const,
  name: 'if-flow',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'if1',
      type: 'if',
      name: 'If',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'codeTrue',
      type: 'code',
      name: 'Code True',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'codeFalse',
      type: 'code',
      name: 'Code False',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [
    { from: 't', to: 'if1' },
    { from: 'if1', to: 'codeTrue', fromOutput: '0' },
    { from: 'if1', to: 'codeFalse', fromOutput: '1' },
  ],
};

describe('firstEdgeOnPathToTarget', () => {
  it('returns edge from IF to target on true branch', () => {
    const edge = firstEdgeOnPathToTarget(ifDef, 'if1', 'codeTrue');
    expect(edge?.fromOutput).toBe('0');
    expect(edge?.to).toBe('codeTrue');
  });
});

describe('itemsOnPathBranch', () => {
  it('returns only the branch items for the path edge', () => {
    const edge = firstEdgeOnPathToTarget(ifDef, 'if1', 'codeTrue');
    const items = itemsOnPathBranch(
      {
        status: 'success',
        outputItems: [[], [{ json: { x: 1 } }]],
      },
      edge,
    );
    expect(items).toEqual([]);
  });
});
