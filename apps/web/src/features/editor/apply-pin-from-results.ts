import type { WorkflowDefinition } from '../../api/client.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import type { PinDataMap, WorkflowItem } from './editor-debug-types.js';
import { getNodePorts } from './node-port-defs.js';

export type NodeRunPinResult = {
  status: string;
  outputItems?: WorkflowItem[][];
};

export function isMultiOutputNodeType(
  type: string,
  parameters?: Record<string, unknown>,
): boolean {
  return getNodePorts(type, parameters).outputs.length > 1;
}

/** Apply node run results to pin maps without flattening multi-output branches into pinData. */
export function applyPinFromResultsToMaps(
  definition: WorkflowDefinition,
  prevPinData: PinDataMap,
  prevPinBranchData: PinBranchDataMap,
  results: Record<string, NodeRunPinResult>,
): { pinData: PinDataMap; pinBranchData: PinBranchDataMap } {
  const pinData = { ...prevPinData };
  const pinBranchData = { ...prevPinBranchData };

  for (const [nodeId, r] of Object.entries(results)) {
    if (r.status !== 'success' || !r.outputItems?.length) continue;

    const node = definition.nodes.find((n) => n.id === nodeId);
    const type = node?.type ?? 'set';
    const parameters = node?.parameters;

    if (isMultiOutputNodeType(type, parameters)) {
      const hasAny = r.outputItems.some((b) => b.length > 0);
      if (hasAny) {
        pinBranchData[nodeId] = r.outputItems.map((b) => [...b]);
      }
      delete pinData[nodeId];
      continue;
    }

    const branch = r.outputItems[0] ?? [];
    if (branch.length > 0) {
      pinData[nodeId] = [...branch];
    }
    delete pinBranchData[nodeId];
  }

  return { pinData, pinBranchData };
}
