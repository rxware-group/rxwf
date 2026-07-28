import type { WorkflowItem } from '@rxwf/shared';

/**
 * Whether to skip executing a node because no upstream branch delivered items.
 * Triggers / graph roots (no incoming edges) are never skipped here.
 */
export function shouldSkipEmptyInput(
  nodeType: string,
  incomingEdgeCount: number,
  inputItems: WorkflowItem[],
  inputBranches?: WorkflowItem[][],
): boolean {
  if (incomingEdgeCount === 0) return false;
  if (nodeType === 'merge') {
    return (inputBranches ?? []).every((branch) => branch.length === 0);
  }
  return inputItems.length === 0;
}
