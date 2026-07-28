import { describe, it, expect } from 'vitest';
import { Position } from '@xyflow/react';
import {
  edgeSourceRunStatus,
  getEdgeOutputBadgePosition,
  getWorkflowEdgePath,
  handlesAlignedForStraightLine,
  isBackwardFlowEdge,
  pruneOrphanConnections,
  runStatusColorToken,
} from './workflow-edge-utils.js';

describe('runStatusColorToken', () => {
  it('maps executed statuses to theme tokens', () => {
    expect(runStatusColorToken('success')).toBe('--rxwf-node-run-success');
    expect(runStatusColorToken('failed')).toBe('--rxwf-node-run-failed');
    expect(runStatusColorToken('running')).toBe('--rxwf-node-run-running');
    expect(runStatusColorToken(undefined)).toBeNull();
  });
});

describe('handlesAlignedForStraightLine', () => {
  it('detects horizontal and vertical alignment', () => {
    expect(
      handlesAlignedForStraightLine(0, 100, Position.Right, 200, 100, Position.Left),
    ).toBe(true);
    expect(
      handlesAlignedForStraightLine(0, 100, Position.Right, 200, 102, Position.Left),
    ).toBe(false);
    expect(
      handlesAlignedForStraightLine(50, 0, Position.Bottom, 50, 200, Position.Top),
    ).toBe(true);
    expect(
      handlesAlignedForStraightLine(50, 0, Position.Bottom, 80, 200, Position.Top),
    ).toBe(false);
    expect(
      handlesAlignedForStraightLine(0, 0, Position.Right, 50, 200, Position.Top),
    ).toBe(false);
  });
});

describe('getWorkflowEdgePath', () => {
  it('uses a straight segment when handles share an axis', () => {
    const [straight] = getWorkflowEdgePath({
      sourceX: 0,
      sourceY: 100,
      sourcePosition: Position.Right,
      targetX: 200,
      targetY: 100,
      targetPosition: Position.Left,
    });
    expect(straight).not.toContain('C');

    const [curved] = getWorkflowEdgePath({
      sourceX: 0,
      sourceY: 100,
      sourcePosition: Position.Right,
      targetX: 200,
      targetY: 140,
      targetPosition: Position.Left,
    });
    expect(curved).toContain('C');
  });

  it('routes backward edges with smooth step below the nodes', () => {
    expect(
      isBackwardFlowEdge(400, 200, Position.Right, 120, 180, Position.Left),
    ).toBe(true);
    const [loopBack] = getWorkflowEdgePath({
      sourceX: 400,
      sourceY: 200,
      sourcePosition: Position.Right,
      targetX: 120,
      targetY: 180,
      targetPosition: Position.Left,
    });
    expect(loopBack).not.toContain('C');
    expect(loopBack).toMatch(/Q|L/);
  });
});

describe('edgeSourceRunStatus', () => {
  it('returns executed statuses only', () => {
    const debug = {
      a: { status: 'success' as const },
      b: { status: 'idle' as const },
      c: { status: 'running' as const },
    };
    expect(edgeSourceRunStatus('a', 'main', debug)).toBe('success');
    expect(edgeSourceRunStatus('b', 'main', debug)).toBeUndefined();
    expect(edgeSourceRunStatus('c', 'main', debug)).toBe('running');
    expect(edgeSourceRunStatus('missing', 'main', debug)).toBeUndefined();
  });

  it('returns undefined when success branch has zero items', () => {
    const debug = {
      if1: {
        status: 'success' as const,
        outputItems: [[], [{ json: { x: 1 } }]],
      },
    };
    expect(edgeSourceRunStatus('if1', '0', debug)).toBeUndefined();
    expect(edgeSourceRunStatus('if1', '1', debug)).toBe('success');
  });

  it('treats Loop loop-branch as success when done branch has items', () => {
    const debug = {
      loop1: {
        status: 'success' as const,
        outputItems: [[], [{ json: { a: 0 } }, { json: { a: 1 } }]],
        loopIterationCount: 2,
        loopBatchItemCount: 1,
      },
    };
    expect(
      edgeSourceRunStatus('loop1', '0', debug, { nodeType: 'loop', parameters: {} }),
    ).toBe('success');
  });
});

describe('getEdgeOutputBadgePosition', () => {
  it('uses path label anchor for loop-back edges', () => {
    const sourceX = 400;
    const sourceY = 200;
    const targetX = 120;
    const targetY = 180;
    const [, labelX, labelY] = getWorkflowEdgePath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
    });
    const badge = getEdgeOutputBadgePosition(
      sourceX,
      sourceY,
      Position.Right,
      targetX,
      targetY,
      Position.Left,
      labelX,
      labelY,
    );
    expect(badge).toEqual({ x: labelX, y: labelY });
  });

  it('uses path label anchor for curved forward edges', () => {
    const sourceX = 100;
    const sourceY = 100;
    const targetX = 300;
    const targetY = 140;
    const [, labelX, labelY] = getWorkflowEdgePath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
    });
    const badge = getEdgeOutputBadgePosition(
      sourceX,
      sourceY,
      Position.Right,
      targetX,
      targetY,
      Position.Left,
      labelX,
      labelY,
    );
    expect(badge).toEqual({ x: labelX, y: labelY });
  });
});

describe('pruneOrphanConnections', () => {
  it('removes connections whose endpoints were deleted', () => {
    const pruned = pruneOrphanConnections({
      nodes: [{ id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} }],
      connections: [
        { from: 'a', to: 'b', fromOutput: 'main', toInput: 'main' },
        { from: 'b', to: 'c', fromOutput: 'main', toInput: 'main' },
      ],
    });
    expect(pruned).toEqual([]);
  });
});
