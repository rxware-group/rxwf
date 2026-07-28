import { describe, expect, it } from 'vitest';
import { pruneEmptyBranchDownstream } from './prune-empty-branch-downstream.js';

const ifDef = {
  schemaVersion: 1 as const,
  name: 'if-flow',
  nodes: [
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
    { from: 'if1', to: 'codeTrue', fromOutput: '0' },
    { from: 'if1', to: 'codeFalse', fromOutput: '1' },
  ],
};

describe('pruneEmptyBranchDownstream', () => {
  it('removes stale success debug on empty true branch downstream', () => {
    const branches = [[], [{ json: { onFalse: true } }]];
    const pruned = pruneEmptyBranchDownstream(
      ifDef,
      'if1',
      branches,
      {
        if1: { status: 'success', outputItems: branches, itemCount: 1 },
        codeTrue: {
          status: 'success',
          itemCount: 1,
          outputItems: [[{ json: { stale: true } }]],
        },
        codeFalse: { status: 'success', itemCount: 1 },
      },
      { codeTrue: [{ json: { stale: true } }] },
      {},
    );
    expect(pruned.nodeDebug.codeTrue).toBeUndefined();
    expect(pruned.nodeDebug.codeFalse).toBeDefined();
    expect(pruned.pinData.codeTrue).toBeUndefined();
  });

  it('keeps merge debug when any incoming branch still has items', () => {
    const mergeDef = {
      schemaVersion: 1 as const,
      name: 'merge-flow',
      nodes: [
        {
          id: 'if1',
          type: 'if',
          name: 'If',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'set1',
          type: 'set',
          name: 'Set',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'merge1',
          type: 'merge',
          name: 'Merge',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 'if1', to: 'merge1', fromOutput: '0' },
        { from: 'set1', to: 'merge1' },
      ],
    };
    const ifBranches = [[], [{ json: { x: 1 } }]];
    const pruned = pruneEmptyBranchDownstream(
      mergeDef,
      'if1',
      ifBranches,
      {
        if1: { status: 'success', outputItems: ifBranches },
        set1: {
          status: 'success',
          outputItems: [[{ json: { fromSet: true } }]],
        },
        merge1: { status: 'success', itemCount: 1 },
      },
    );
    expect(pruned.nodeDebug.merge1).toBeDefined();
  });

  it('preserves loop body debug when loop loop-branch output is empty', () => {
    const loopDef = {
      schemaVersion: 1 as const,
      name: 'loop-flow',
      nodes: [
        {
          id: 'loop1',
          type: 'loop',
          name: 'Loop',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'cmd',
          type: 'executeCommand',
          name: 'Execute Command',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'doneCmd',
          type: 'executeCommand',
          name: 'Execute Command 2',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 'loop1', to: 'cmd', fromOutput: '0' },
        { from: 'cmd', to: 'loop1' },
        { from: 'loop1', to: 'doneCmd', fromOutput: '1' },
      ],
    };
    const loopOutputs = [[], [{ json: { a: 0 } }, { json: { a: 1 } }]];
    const pruned = pruneEmptyBranchDownstream(
      loopDef,
      'loop1',
      loopOutputs,
      {
        loop1: { status: 'success', outputItems: loopOutputs, itemCount: 2 },
        cmd: {
          status: 'success',
          itemCount: 2,
          outputItems: [[{ json: { ran: true } }]],
        },
        doneCmd: { status: 'idle' },
      },
    );
    expect(pruned.nodeDebug.cmd).toBeDefined();
    expect(pruned.nodeDebug.cmd?.status).toBe('success');
  });
});
