import { snapPointToGrid } from './canvas-grid.js';

/** 将节点左上角偏移到视口中心（约 96×96 节点体） */
export const DEFAULT_NODE_CENTER_OFFSET = { x: 48, y: 48 } as const;

export type FlowPositionGetter = () => { x: number; y: number };

export function nodePositionAtViewportCenter(
  center: { x: number; y: number },
  indexBump = 0,
  offset: { x: number; y: number } = DEFAULT_NODE_CENTER_OFFSET,
): { x: number; y: number } {
  const bump = indexBump * 16;
  return snapPointToGrid({
    x: center.x - offset.x + bump,
    y: center.y - offset.y + bump,
  });
}
