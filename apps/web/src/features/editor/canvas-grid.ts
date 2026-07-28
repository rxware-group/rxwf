/** 与画布 Background gap 一致 */
export const CANVAS_GRID_SIZE = 16;

export function snapAxisToGrid(value: number, gridSize = CANVAS_GRID_SIZE): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  return snapped === 0 ? 0 : snapped;
}

export function snapPointToGrid(
  point: { x: number; y: number },
  gridSize = CANVAS_GRID_SIZE,
): { x: number; y: number } {
  return {
    x: snapAxisToGrid(point.x, gridSize),
    y: snapAxisToGrid(point.y, gridSize),
  };
}
