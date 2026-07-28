/** Keep live drag position; otherwise follow definition when it diverges (load/undo). */
export function resolveFlowNodePositionAfterDefinitionUpdate(
  definitionPosition: { x: number; y: number },
  previousFlowPosition: { x: number; y: number },
  dragging: boolean,
): { x: number; y: number } {
  if (dragging) return previousFlowPosition;
  const diverged =
    Math.abs(definitionPosition.x - previousFlowPosition.x) > 0.5 ||
    Math.abs(definitionPosition.y - previousFlowPosition.y) > 0.5;
  return diverged ? definitionPosition : previousFlowPosition;
}
