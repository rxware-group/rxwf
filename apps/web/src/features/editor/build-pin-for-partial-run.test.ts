import { describe, expect, it } from 'vitest';
import {
  buildPinForPartialRun,
  listPartialRunNodeIds,
} from './build-pin-for-partial-run.js';

const def = {
  schemaVersion: 1 as const,
  name: 'w',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'j',
      type: 'json',
      name: 'JSON',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'j2',
      type: 'json',
      name: 'JSON 2',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [
    { from: 't', to: 'j' },
    { from: 'j', to: 'j2' },
  ],
};

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

describe('buildPinForPartialRun', () => {
  it('pins only executed upstream and never the target', () => {
    const pin = buildPinForPartialRun(
      def,
      'j2',
      { t: [{ json: { ok: true } }] },
      {
        j: {
          status: 'success',
          outputItems: [[{ json: { a: 1 } }]],
        },
      },
    );
    expect(pin.pinData.t).toEqual([{ json: { ok: true } }]);
    expect(pin.pinData.j).toEqual([{ json: { a: 1 } }]);
    expect(pin.pinData.j2).toBeUndefined();
  });

  it('lists unexecuted upstream then target', () => {
    const pinForRun = buildPinForPartialRun(def, 'j2', {}, {});
    expect(listPartialRunNodeIds(def, 'j2', pinForRun)).toEqual(['t', 'j', 'j2']);
    const pinForRun2 = buildPinForPartialRun(
      def,
      'j2',
      { t: [{ json: {} }], j: [{ json: {} }] },
      {},
    );
    expect(listPartialRunNodeIds(def, 'j2', pinForRun2)).toEqual(['j2']);
  });

  it('does not pin IF when path branch is empty (true downstream)', () => {
    const pin = buildPinForPartialRun(ifDef, 'codeTrue', {}, {
      if1: {
        status: 'success',
        outputItems: [[], [{ json: { onFalse: true } }]],
      },
    });
    expect(pin.pinData.if1).toBeUndefined();
    expect(pin.pinBranchData.if1).toBeUndefined();
  });

  it('ignores polluted flat pinData on multi-output IF when true branch is empty', () => {
    const pin = buildPinForPartialRun(
      ifDef,
      'codeTrue',
      { if1: [{ json: { polluted: true } }] },
      {
        if1: {
          status: 'success',
          outputItems: [[], [{ json: { onFalse: true } }]],
        },
      },
      { if1: [[], [{ json: { onFalse: true } }]] },
    );
    expect(pin.pinData.if1).toBeUndefined();
    expect(pin.pinBranchData.if1).toBeUndefined();
  });

  it('pins IF with full branches when targeting false downstream', () => {
    const branches = [[], [{ json: { onFalse: true } }]];
    const pin = buildPinForPartialRun(ifDef, 'codeFalse', {}, {
      if1: {
        status: 'success',
        outputItems: branches,
      },
    });
    expect(pin.pinBranchData.if1).toEqual(branches);
    expect(pin.pinData.if1).toBeUndefined();
  });
});
