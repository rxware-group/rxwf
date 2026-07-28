import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import { readThemeToken, useThemeVersion } from '../../hooks/use-theme-id.js';
import { IconTrash } from './NodeToolbarIcons.js';
import {
  getEdgeOutputBadgePosition,
  getWorkflowEdgePath,
  offsetFromPort,
  runStatusColorToken,
  type WorkflowEdgeData,
} from './workflow-edge-utils.js';

const ARROW_LEN = 7;
const ARROW_HALF = 3.5;
/** 与 .workflow-handle 外径一致：10px 圆 + 1px 边框 */
const HANDLE_RADIUS = 6;

function unitVector(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function arrowPointsOnEdge(
  tipX: number,
  tipY: number,
  towardX: number,
  towardY: number,
): string {
  const { x: ux, y: uy } = unitVector(towardX - tipX, towardY - tipY);
  const bx = tipX - ux * ARROW_LEN;
  const by = tipY - uy * ARROW_LEN;
  const px = -uy * ARROW_HALF;
  const py = ux * ARROW_HALF;
  return `${tipX},${tipY} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

export function WorkflowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  data,
  style,
  selected,
}: EdgeProps) {
  const labels = useLabels();

  const edgeData = data as WorkflowEdgeData | undefined;
  const isResource = edgeData?.kind === 'resource';
  const readOnly = Boolean(edgeData?.readOnly);
  const [hovered, setHovered] = useState(false);
  const hideHoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearHideHover = () => {
    if (hideHoverTimerRef.current !== undefined) {
      clearTimeout(hideHoverTimerRef.current);
      hideHoverTimerRef.current = undefined;
    }
  };

  const showHover = () => {
    clearHideHover();
    setHovered(true);
  };

  const scheduleHideHover = () => {
    clearHideHover();
    hideHoverTimerRef.current = setTimeout(() => setHovered(false), 200);
  };

  useEffect(() => () => clearHideHover(), []);

  const sourceEdge = offsetFromPort(
    sourceX,
    sourceY,
    sourcePosition,
    HANDLE_RADIUS,
  );
  const targetEdge = offsetFromPort(
    targetX,
    targetY,
    targetPosition,
    HANDLE_RADIUS,
  );

  const [path, labelX, labelY] = getWorkflowEdgePath({
    sourceX: sourceEdge.x,
    sourceY: sourceEdge.y,
    sourcePosition,
    targetX: targetEdge.x,
    targetY: targetEdge.y,
    targetPosition,
  });

  const themeVersion = useThemeVersion();
  const edgeColor = useMemo(() => readThemeToken('--rxwf-edge', '#6e7681'), [themeVersion]);
  const accentColor = useMemo(() => readThemeToken('--rxwf-accent', '#f97316'), [themeVersion]);
  const runStatusToken = runStatusColorToken(edgeData?.sourceRunStatus);
  const runStatusColor = useMemo(
    () => (runStatusToken ? readThemeToken(runStatusToken, edgeColor) : null),
    [runStatusToken, edgeColor, themeVersion],
  );

  const highlighted = !readOnly && (selected || hovered);
  const stroke = highlighted ? accentColor : (runStatusColor ?? edgeColor);
  const strokeWidth = highlighted ? (isResource ? 1.5 : 2) : isResource ? 1 : 1;

  const arrow =
    isResource
      ? null
      : arrowPointsOnEdge(targetEdge.x, targetEdge.y, targetX, targetY);

  const outputBadgeText = edgeData?.outputBadgeText;
  const outputBadgeStatus = edgeData?.outputBadgeStatus ?? 'success';
  const badgePos = getEdgeOutputBadgePosition(
    sourceEdge.x,
    sourceEdge.y,
    sourcePosition,
    targetEdge.x,
    targetEdge.y,
    targetPosition,
    labelX,
    labelY,
  );

  return (
    <>
      {!readOnly && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          className="workflow-edge-hit"
          onMouseEnter={showHover}
          onMouseLeave={scheduleHideHover}
        />
      )}
      <BaseEdge
        path={path}
        markerEnd={undefined}
        markerStart={undefined}
        style={{
          ...style,
          stroke,
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeDasharray: isResource ? '7 5' : undefined,
        }}
        interactionWidth={0}
      />
      {arrow && (
        <polygon
          className="workflow-edge-arrow"
          points={arrow}
          fill={stroke}
          stroke="none"
          onMouseEnter={readOnly ? undefined : showHover}
          onMouseLeave={readOnly ? undefined : scheduleHideHover}
        />
      )}
      {outputBadgeText && (
        <EdgeLabelRenderer>
          <div
            className={`workflow-edge-output-badge workflow-edge-output-badge--${outputBadgeStatus} nodrag nopan`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${badgePos.x}px, ${badgePos.y}px)`,
              pointerEvents: 'none',
            }}
          >
            {outputBadgeText}
          </div>
        </EdgeLabelRenderer>
      )}
      {!readOnly && (hovered || selected) && edgeData?.onDelete && (
        <EdgeLabelRenderer>
          <div
            className="workflow-edge-delete-wrap nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={showHover}
            onMouseLeave={scheduleHideHover}
          >
            <button
              type="button"
              className="workflow-edge-delete"
              title={t(labels, 'auto.t_0a7114b5')}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                edgeData.onDelete?.();
              }}
            >
              <IconTrash />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
