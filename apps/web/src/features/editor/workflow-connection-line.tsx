import { type ConnectionLineComponentProps } from '@xyflow/react';
import { isResourcePortId } from './node-port-defs.js';
import { getWorkflowEdgePath, offsetFromPort } from './workflow-edge-utils.js';

const HANDLE_RADIUS = 6;

export function WorkflowConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  fromHandle,
}: ConnectionLineComponentProps) {
  const resource = isResourcePortId(fromHandle?.id ?? '');
  const sourceEdge = offsetFromPort(fromX, fromY, fromPosition, HANDLE_RADIUS);
  const targetEdge = offsetFromPort(toX, toY, toPosition, HANDLE_RADIUS);
  const [path] = getWorkflowEdgePath({
    sourceX: sourceEdge.x,
    sourceY: sourceEdge.y,
    sourcePosition: fromPosition,
    targetX: targetEdge.x,
    targetY: targetEdge.y,
    targetPosition: toPosition,
  });

  return (
    <g>
      <path
        fill="none"
        className={
          resource
            ? 'workflow-connection-line workflow-connection-line--resource'
            : 'workflow-connection-line'
        }
        d={path}
      />
    </g>
  );
}
