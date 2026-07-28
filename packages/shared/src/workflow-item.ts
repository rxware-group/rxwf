import type { BinaryMap } from './binary-map.js';
import { isBinaryMap } from './binary-map.js';

export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: BinaryMap;
}

export function createWorkflowItem(
  json: Record<string, unknown>,
  binary?: BinaryMap,
): WorkflowItem {
  const item: WorkflowItem = { json };
  if (binary && Object.keys(binary).length > 0) {
    item.binary = binary;
  }
  return item;
}

export function isWorkflowItem(value: unknown): value is WorkflowItem {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as WorkflowItem).json === 'object' &&
    (value as WorkflowItem).json !== null &&
    !Array.isArray((value as WorkflowItem).json) &&
    ((value as WorkflowItem).binary === undefined ||
      isBinaryMap((value as WorkflowItem).binary))
  );
}

export function hasBinary(item: WorkflowItem): boolean {
  return item.binary !== undefined && Object.keys(item.binary).length > 0;
}
