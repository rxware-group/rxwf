import { getBezierPath, getSmoothStepPath, getStraightPath, Position } from '@xyflow/react';
import type { WorkflowDefinition } from '../../api/client.js';
import type { NodeDebugState, NodeDebugStatus } from './editor-debug-types.js';
import { outputHandleToIndex, type OutputHandleIndexContext } from './node-port-defs.js';

export type WorkflowEdgeKind = 'main' | 'resource';

export type EdgeSourceRunStatus = Extract<NodeDebugStatus, 'running' | 'success' | 'failed'>;

export type WorkflowEdgeData = {
  onDelete?: () => void;
  readOnly?: boolean;
  kind?: WorkflowEdgeKind;
  /** 上游节点已执行时的调试状态，用于连线着色 */
  sourceRunStatus?: EdgeSourceRunStatus;
  /** 主流程 / 资源连线上的输出项数徽章 */
  outputBadgeText?: string;
  outputBadgeStatus?: EdgeSourceRunStatus;
};

export function runStatusColorToken(
  status: EdgeSourceRunStatus | undefined,
): string | null {
  switch (status) {
    case 'success':
      return '--rxwf-node-run-success';
    case 'failed':
      return '--rxwf-node-run-failed';
    case 'running':
      return '--rxwf-node-run-running';
    default:
      return null;
  }
}

export function edgeSourceRunStatus(
  nodeId: string,
  fromOutput: string | undefined,
  nodeDebug: Record<string, NodeDebugState>,
  handleContext?: OutputHandleIndexContext,
): EdgeSourceRunStatus | undefined {
  const debug = nodeDebug[nodeId];
  if (!debug) return undefined;
  const status = debug.status;
  if (status === 'running' || status === 'failed') {
    return status;
  }
  if (status === 'success') {
    const idx = outputHandleToIndex(fromOutput, handleContext);
    const branch = debug.outputItems?.[idx];
    if (branch !== undefined && branch.length === 0) {
      if (handleContext?.nodeType === 'loop' && idx === 0) {
        const doneBranch = debug.outputItems?.[1];
        if (doneBranch && doneBranch.length > 0) return 'success';
        if ((debug.loopIterationCount ?? 0) > 0) return 'success';
      }
      return undefined;
    }
    return 'success';
  }
  return undefined;
}

export function connectionEdgeId(
  c: WorkflowDefinition['connections'][number],
): string {
  return `e-${c.from}-${c.to}-${c.fromOutput ?? 'main'}-${c.toInput ?? 'main'}`;
}

/** Drop connections whose endpoints no longer exist (stale persistence / race after delete). */
export function pruneOrphanConnections(
  definition: Pick<WorkflowDefinition, 'nodes' | 'connections'>,
): WorkflowDefinition['connections'] {
  const nodeIds = new Set(definition.nodes.map((n) => n.id));
  return definition.connections.filter(
    (c) => nodeIds.has(c.from) && nodeIds.has(c.to),
  );
}

const HANDLE_ALIGN_EPSILON = 1;

function isHorizontalPort(position: Position): boolean {
  return position === Position.Left || position === Position.Right;
}

function isVerticalPort(position: Position): boolean {
  return position === Position.Top || position === Position.Bottom;
}

/** 端口在同一水平线或垂直线上时使用直线连线 */
export function handlesAlignedForStraightLine(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): boolean {
  if (isHorizontalPort(sourcePosition) && isHorizontalPort(targetPosition)) {
    return Math.abs(sourceY - targetY) <= HANDLE_ALIGN_EPSILON;
  }
  if (isVerticalPort(sourcePosition) && isVerticalPort(targetPosition)) {
    return Math.abs(sourceX - targetX) <= HANDLE_ALIGN_EPSILON;
  }
  return false;
}

const BACKWARD_EDGE_GAP = 24;
/** Below handle Y: half node body (--wf-node-size 72) + caption + clearance. */
const LOOP_ROUTE_PADDING = 84;
const LOOP_ROUTE_MIN_OFFSET = 48;
const LOOP_ROUTE_MAX_OFFSET = 120;

/** Edge flows against the natural port direction (e.g. right → left with target on the left). */
export function isBackwardFlowEdge(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): boolean {
  if (sourcePosition === Position.Right && targetPosition === Position.Left) {
    return targetX < sourceX - BACKWARD_EDGE_GAP;
  }
  if (sourcePosition === Position.Left && targetPosition === Position.Right) {
    return targetX > sourceX + BACKWARD_EDGE_GAP;
  }
  if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
    return targetY > sourceY + BACKWARD_EDGE_GAP;
  }
  if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
    return targetY < sourceY - BACKWARD_EDGE_GAP;
  }
  return false;
}

function backwardEdgePath(params: {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}): [string, number, number] {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } = params;
  const span = Math.hypot(targetX - sourceX, targetY - sourceY);
  const offset = Math.max(
    LOOP_ROUTE_MIN_OFFSET,
    Math.min(LOOP_ROUTE_MAX_OFFSET, span * 0.12),
  );

  const smoothParams: Parameters<typeof getSmoothStepPath>[0] = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset,
    borderRadius: 16,
  };

  if (isHorizontalPort(sourcePosition) && isHorizontalPort(targetPosition)) {
    smoothParams.centerY = Math.max(sourceY, targetY) + LOOP_ROUTE_PADDING;
  } else if (isVerticalPort(sourcePosition) && isVerticalPort(targetPosition)) {
    smoothParams.centerX = Math.max(sourceX, targetX) + LOOP_ROUTE_PADDING;
  }

  const [path, labelX, labelY] = getSmoothStepPath(smoothParams);
  return [path, labelX, labelY];
}

export function getWorkflowEdgePath(params: {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}): [string, number, number] {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } = params;

  if (
    handlesAlignedForStraightLine(
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    )
  ) {
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return [path, labelX, labelY];
  }

  if (
    isBackwardFlowEdge(
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    )
  ) {
    return backwardEdgePath(params);
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return [path, labelX, labelY];
}

/** Place output-count badge on the edge path (xyflow label anchor). */
export function getEdgeOutputBadgePosition(
  _sourceX: number,
  _sourceY: number,
  _sourcePosition: Position,
  _targetX: number,
  _targetY: number,
  _targetPosition: Position,
  labelX: number,
  labelY: number,
): { x: number; y: number } {
  return { x: labelX, y: labelY };
}

/** 从端口圆心沿端口朝向偏移（朝节点外为正方向） */
export function offsetFromPort(
  x: number,
  y: number,
  position: Position,
  distance: number,
): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: x - distance, y };
    case Position.Right:
      return { x: x + distance, y };
    case Position.Top:
      return { x, y: y - distance };
    case Position.Bottom:
      return { x, y: y + distance };
    default:
      return { x: x + distance, y };
  }
}
