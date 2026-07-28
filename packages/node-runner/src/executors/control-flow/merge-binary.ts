import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import { mergeBinaryMaps } from '@rxwf/shared';

/** CONF-04 combineByKey: first non-empty binary in item order. */
export function firstNonEmptyBinary(items: WorkflowItem[]): BinaryMap | undefined {
  for (const item of items) {
    if (item.binary && Object.keys(item.binary).length > 0) {
      return item.binary;
    }
  }
  return undefined;
}

/** Merge binary maps from all items (later keys override same key). */
export function mergeBinaryFromItems(items: WorkflowItem[]): BinaryMap | undefined {
  let merged: BinaryMap | undefined;
  for (const item of items) {
    merged = mergeBinaryMaps(merged, item.binary);
  }
  return merged;
}

/** Merge binary maps from all branches (combineAll upstream preservation). */
export function mergeBinaryFromBranches(
  branches: WorkflowItem[][],
): BinaryMap | undefined {
  return mergeBinaryFromItems(branches.flat());
}

/** combineByKey group merge: json assign + first non-empty binary. */
export function mergeJsonItemsWithBinary(items: WorkflowItem[]): WorkflowItem {
  const merged: Record<string, unknown> = {};
  for (const item of items) {
    if (item.json && typeof item.json === 'object' && !Array.isArray(item.json)) {
      Object.assign(merged, item.json as Record<string, unknown>);
    }
  }
  const out: WorkflowItem = { json: merged };
  const binary = firstNonEmptyBinary(items);
  if (binary) {
    out.binary = binary;
  }
  return out;
}

/** combineAll: wrap branch json lists and preserve upstream binary (GAP-01). */
export function buildCombineAllItem(branches: WorkflowItem[][]): WorkflowItem {
  const out: WorkflowItem = {
    json: {
      branches: branches.map((branch) =>
        branch.map((item) => item.json ?? {}),
      ),
    },
  };
  const binary = mergeBinaryFromBranches(branches);
  if (binary && Object.keys(binary).length > 0) {
    out.binary = binary;
  }
  return out;
}
