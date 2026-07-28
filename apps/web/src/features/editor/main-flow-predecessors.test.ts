import { describe, expect, it } from 'vitest';
import {
  areMainFlowPredecessorsExecuted,
  findMainFlowTriggerOnPath,
  getDirectMainFlowPredecessor,
  getMainFlowPredecessorsRunTarget,
  isDirectMainFlowPredecessorExecuted,
  listMainFlowPredecessorNodes,
} from './main-flow-predecessors.js';

describe('main-flow-predecessors', () => {
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
        id: 'm',
        type: 'aiChatModel',
        name: 'Chat Model',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'a',
        type: 'set',
        name: 'Set A',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 's',
        type: 'skillRun',
        name: 'Skill',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [
      { from: 't', to: 'a' },
      { from: 'a', to: 's' },
      { from: 'm', to: 's', toInput: 'ai_languageModel' },
    ],
  };

  it('listMainFlowPredecessorNodes excludes satellites', () => {
    expect(listMainFlowPredecessorNodes(def, 's').map((n) => n.id)).toEqual(['t', 'a']);
  });

  it('getDirectMainFlowPredecessor returns main-input node only', () => {
    expect(getDirectMainFlowPredecessor(def, 's')).toEqual({ id: 'a', name: 'Set A' });
  });

  it('isDirectMainFlowPredecessorExecuted when direct pred has success debug', () => {
    expect(
      isDirectMainFlowPredecessorExecuted(def, 's', {}, {}, {
        a: { status: 'success', outputItems: [[{ json: { x: 1 } }]] },
      }),
    ).toBe(true);
    expect(isDirectMainFlowPredecessorExecuted(def, 's', {}, {}, {})).toBe(false);
  });

  it('findMainFlowTriggerOnPath returns trigger on main path', () => {
    expect(findMainFlowTriggerOnPath(def, 's')).toEqual({ id: 't', name: 'Manual' });
    expect(findMainFlowTriggerOnPath(def, 't')).toEqual({ id: 't', name: 'Manual' });
  });

  it('getMainFlowPredecessorsRunTarget is last main-flow pred', () => {
    expect(getMainFlowPredecessorsRunTarget(def, 's')).toBe('a');
    expect(getMainFlowPredecessorsRunTarget(def, 't')).toBeNull();
  });

  it('areMainFlowPredecessorsExecuted requires full chain from trigger', () => {
    expect(areMainFlowPredecessorsExecuted(def, 's', {}, {}, {})).toBe(false);
    expect(
      areMainFlowPredecessorsExecuted(def, 's', {}, {}, {
        a: { status: 'success', outputItems: [[{ json: { x: 1 } }]] },
      }),
    ).toBe(false);
    expect(
      areMainFlowPredecessorsExecuted(def, 's', {}, {}, {
        t: { status: 'success', outputItems: [[{ json: {} }]] },
        a: { status: 'success', outputItems: [[{ json: { x: 1 } }]] },
      }),
    ).toBe(true);
  });

  it('areMainFlowPredecessorsExecuted ignores loop body feedback as Loop predecessors', () => {
    const loopDef = {
      schemaVersion: 1 as const,
      name: 'loop',
      nodes: [
        {
          id: 't',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'loop',
          type: 'loop',
          name: 'Loop',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'body',
          type: 'set',
          name: 'Body',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't', to: 'loop' },
        { from: 'loop', to: 'body', fromOutput: '0' },
        { from: 'body', to: 'loop' },
      ],
    };

    expect(listMainFlowPredecessorNodes(loopDef, 'loop').map((n) => n.id)).toEqual(['t']);
    expect(
      areMainFlowPredecessorsExecuted(loopDef, 'loop', {}, {}, {
        t: { status: 'success', outputItems: [[{ json: { a: 0 } }, { json: { a: 1 } }]] },
      }),
    ).toBe(true);
    expect(getDirectMainFlowPredecessor(loopDef, 'loop')).toEqual({ id: 't', name: 'Manual' });
  });

  it('done-branch downstream only requires Manual and Loop as predecessors', () => {
    const loopDef = {
      schemaVersion: 1 as const,
      name: 'loop-done',
      nodes: [
        {
          id: 't',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'loop',
          type: 'loop',
          name: 'Loop',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'body',
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
        { from: 't', to: 'loop' },
        { from: 'loop', to: 'body', fromOutput: '0' },
        { from: 'body', to: 'loop' },
        { from: 'loop', to: 'doneCmd', fromOutput: '1' },
      ],
    };

    expect(listMainFlowPredecessorNodes(loopDef, 'doneCmd').map((n) => n.id)).toEqual([
      't',
      'loop',
    ]);
    expect(
      areMainFlowPredecessorsExecuted(loopDef, 'doneCmd', {}, {}, {
        t: { status: 'success', outputItems: [[{ json: { a: 0 } }, { json: { a: 1 } }]] },
        loop: {
          status: 'success',
          outputItems: [[], [{ json: { a: 0 } }, { json: { a: 1 } }]],
        },
      }),
    ).toBe(true);
    expect(getDirectMainFlowPredecessor(loopDef, 'doneCmd')).toEqual({
      id: 'loop',
      name: 'Loop',
    });
  });
});
