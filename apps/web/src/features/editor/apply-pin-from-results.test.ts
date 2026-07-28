import { describe, expect, it } from 'vitest';
import { applyPinFromResultsToMaps } from './apply-pin-from-results.js';

const baseDef = {
  schemaVersion: 1 as const,
  name: 'w',
  nodes: [
    {
      id: 'if1',
      type: 'if',
      name: 'If',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'sw1',
      type: 'switch',
      name: 'Switch',
      position: { x: 0, y: 0 },
      parameters: {
        branches: [
          { id: 'b0', label: '端口1', condition: '{{ true }}' },
          { id: 'b1', label: '端口2', condition: '{{ false }}' },
          { id: 'b2', label: '端口3', condition: '{{ false }}' },
        ],
      },
    },
    {
      id: 'http1',
      type: 'httpRequest',
      name: 'HTTP',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

describe('applyPinFromResultsToMaps', () => {
  it('stores IF branches in pinBranchData only and removes flat pinData', () => {
    const branches = [[], [{ json: { onFalse: true } }]];
    const applied = applyPinFromResultsToMaps(
      baseDef,
      { if1: [{ json: { polluted: true } }] },
      {},
      {
        if1: { status: 'success', outputItems: branches },
      },
    );
    expect(applied.pinBranchData.if1).toEqual(branches);
    expect(applied.pinData.if1).toBeUndefined();
  });

  it('stores switch branches in pinBranchData only', () => {
    const branches = [[{ json: { a: 1 } }], [], [{ json: { c: 3 } }]];
    const applied = applyPinFromResultsToMaps(
      baseDef,
      {},
      {},
      {
        sw1: { status: 'success', outputItems: branches },
      },
    );
    expect(applied.pinBranchData.sw1).toEqual(branches);
    expect(applied.pinData.sw1).toBeUndefined();
  });

  it('stores single-output HTTP in pinData only', () => {
    const items = [{ json: { ok: true } }];
    const applied = applyPinFromResultsToMaps(
      baseDef,
      {},
      { http1: [[{ json: { old: true } }]] },
      {
        http1: { status: 'success', outputItems: [items] },
      },
    );
    expect(applied.pinData.http1).toEqual(items);
    expect(applied.pinBranchData.http1).toBeUndefined();
  });
});
