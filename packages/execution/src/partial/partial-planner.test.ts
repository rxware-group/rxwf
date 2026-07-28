import { describe, expect, it } from 'vitest';
import {
  listUpstreamIdsInTopologicalOrder,
  planPartialExecution,
} from './partial-planner.js';

describe('listUpstreamIdsInTopologicalOrder', () => {
  it('returns ancestors in topological order excluding target', () => {
    const edges = [
      { from: 't', to: 'a' },
      { from: 'a', to: 'b' },
    ];
    expect(listUpstreamIdsInTopologicalOrder(edges, 'b')).toEqual(['t', 'a']);
  });
});

const manualJsonChain = {
  graph: {
    nodes: [
      { id: 't', type: 'manualTrigger' },
      { id: 'j', type: 'json' },
      { id: 'j2', type: 'json' },
    ],
    edges: [
      { from: 't', to: 'j' },
      { from: 'j', to: 'j2' },
    ],
  },
  targetNodeId: 'j2',
};

describe('planPartialExecution with pinned upstream', () => {
  it('runs full chain in topological order when nothing pinned', () => {
    const plan = planPartialExecution({
      ...manualJsonChain,
      pinData: {},
    });
    expect(plan.executeOrder).toEqual(['t', 'j', 'j2']);
  });

  it('runs only target when all upstream pinned', () => {
    const plan = planPartialExecution({
      ...manualJsonChain,
      pinData: {
        t: [{ json: { m: 1 } }],
        j: [{ json: { a: 1 } }],
      },
    });
    expect(plan.executeOrder).toEqual(['j2']);
    expect(plan.pinnedOutputBranches.get('t')).toEqual([[{ json: { m: 1 } }]]);
    expect(plan.pinnedOutputBranches.get('j')).toEqual([[{ json: { a: 1 } }]]);
  });

  it('runs from first unpinned upstream when only manual pinned', () => {
    const plan = planPartialExecution({
      ...manualJsonChain,
      pinData: { t: [{ json: { m: 1 } }] },
    });
    expect(plan.executeOrder).toEqual(['j', 'j2']);
  });

  it('runs only target when json upstream is pinned', () => {
    const plan = planPartialExecution({
      ...manualJsonChain,
      pinData: { j: [{ json: { a: 1 } }] },
    });
    expect(plan.executeOrder).toEqual(['j2']);
    expect(plan.pinnedOutputBranches.get('j')).toEqual([[{ json: { a: 1 } }]]);
  });

  it('treats pinBranchData as pinned multi-branch output', () => {
    const plan = planPartialExecution({
      ...manualJsonChain,
      pinData: { t: [{ json: { m: 1 } }] },
      pinBranchData: {
        j: [[{ json: { a: 1 } }]],
      },
    });
    expect(plan.executeOrder).toEqual(['j2']);
    expect(plan.pinnedOutputBranches.get('j')).toEqual([[{ json: { a: 1 } }]]);
  });
});

/** Manual → Loop(loop)→EC→Loop 回连；Loop(done)→EC2 — partial 目标 EC2 时 isNeeded 曾无限递归 */
const loopBodyBackToLoopGraph = {
  graph: {
    nodes: [
      { id: 'm', type: 'manualTrigger' },
      { id: 'l', type: 'loop' },
      { id: 'ec1', type: 'executeCommand' },
      { id: 'ec2', type: 'executeCommand' },
    ],
    edges: [
      { from: 'm', to: 'l' },
      { from: 'l', to: 'ec1' },
      { from: 'ec1', to: 'l' },
      { from: 'l', to: 'ec2' },
    ],
  },
  targetNodeId: 'ec2',
};

describe('planPartialExecution with loop body back-edge', () => {
  it('plans done-branch target without stack overflow', () => {
    expect(() =>
      planPartialExecution({ ...loopBodyBackToLoopGraph, pinData: {} }),
    ).not.toThrow();

    const plan = planPartialExecution({ ...loopBodyBackToLoopGraph, pinData: {} });
    expect(plan.executeOrder).toEqual(['m', 'l', 'ec2']);
    expect(plan.executeOrder).not.toContain('ec1');
  });
});
