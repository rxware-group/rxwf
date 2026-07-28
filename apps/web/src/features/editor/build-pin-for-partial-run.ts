import type { WorkflowDefinition } from '../../api/client.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import {
  firstEdgeOnPathToTarget,
  itemsOnPathBranch,
} from './branch-path-utils.js';
import { isMultiOutputNodeType } from './apply-pin-from-results.js';
import type { NodeDebugState, PinDataMap, WorkflowItem } from './editor-debug-types.js';
import { getNodePorts } from './node-port-defs.js';
import { listPredecessorNodes } from './predecessor-nodes.js';

export type PartialRunPin = {
  pinData: PinDataMap;
  pinBranchData: PinBranchDataMap;
};

export function isNodePinnedForPartialRun(
  pin: PartialRunPin,
  nodeId: string,
): boolean {
  return (
    (pin.pinData[nodeId]?.length ?? 0) > 0 || pin.pinBranchData[nodeId] !== undefined
  );
}

/**
 * Pin 已成功执行的上游，供 partial 调试跳过；目标节点永不 pin（总会重跑）。
 * 按 pred→target 路径上的 fromOutput 支路取数；多出口节点 pin 完整 outputItems，禁止 flatten。
 */
export function buildPinForPartialRun(
  definition: WorkflowDefinition,
  targetNodeId: string,
  pinData: PinDataMap,
  nodeDebug: Record<string, NodeDebugState>,
  pinBranchData: PinBranchDataMap = {},
): PartialRunPin {
  const pin: PartialRunPin = { pinData: {}, pinBranchData: {} };

  for (const pred of listPredecessorNodes(definition, targetNodeId)) {
    const node = definition.nodes.find((n) => n.id === pred.id);
    const type = node?.type ?? 'set';
    const parameters = node?.parameters;
    const multiOut = isMultiOutputNodeType(type, parameters);
    const edge = firstEdgeOnPathToTarget(definition, pred.id, targetNodeId);

    if (multiOut) {
      const branches = pinBranchData[pred.id] ?? nodeDebug[pred.id]?.outputItems;
      if (branches?.length) {
        const branchItems = itemsOnPathBranch(
          { status: 'success', outputItems: branches },
          edge,
          definition,
        );
        if (branchItems.length > 0) {
          pin.pinBranchData[pred.id] = branches.map((b) => [...b]);
        }
      }
      continue;
    }

    const existingFlat = pinData[pred.id];
    if (existingFlat?.length) {
      const branchItems = itemsOnPathBranch(
        { status: 'success', outputItems: [[...existingFlat]] },
        edge,
        definition,
      );
      if (branchItems.length > 0) {
        pin.pinData[pred.id] = [...branchItems];
      }
      continue;
    }

    const debug = nodeDebug[pred.id];
    if (debug?.status !== 'success' || !debug.outputItems?.length) continue;

    const branchItems = itemsOnPathBranch(debug, edge, definition);
    if (branchItems.length === 0) continue;

    const outputCount = node
      ? getNodePorts(node.type, node.parameters).outputs.length
      : 1;

    if (outputCount > 1) {
      pin.pinBranchData[pred.id] = debug.outputItems.map((b) => [...b]);
    } else {
      pin.pinData[pred.id] = [...branchItems];
    }
  }

  return pin;
}

/** 本次 partial 运行将实际执行的节点 id（拓扑序，含目标）。 */
export function listPartialRunNodeIds(
  definition: WorkflowDefinition,
  targetNodeId: string,
  pinForRun: PartialRunPin,
): string[] {
  const run: string[] = [];
  for (const pred of listPredecessorNodes(definition, targetNodeId)) {
    if (!isNodePinnedForPartialRun(pinForRun, pred.id)) run.push(pred.id);
  }
  run.push(targetNodeId);
  return run;
}
