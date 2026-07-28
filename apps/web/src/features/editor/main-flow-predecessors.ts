import type { WorkflowDefinition } from '../../api/client.js';
import { getLoopBodyNodeIds } from '@rxwf/workflow/graph-cycle';

const TRIGGER_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
  'subworkflowTrigger',
]);

/** Keep in sync with @rxwf/workflow SATELLITE_NODE_TYPES (avoid heavy workflow import in web). */
const SATELLITE_NODE_TYPES = new Set([
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
  'toolSkill',
  'toolSubagent',
  'toolRead',
  'toolWrite',
  'toolGrep',
  'toolShell',
  'toolWebSearch',
]);

export function isSatelliteNodeType(type: string): boolean {
  return SATELLITE_NODE_TYPES.has(type);
}
import type { PinBranchDataMap } from './branch-path-utils.js';
import { firstEdgeOnPathToTarget } from './branch-path-utils.js';
import {
  buildPinForPartialRun,
  isNodePinnedForPartialRun,
} from './build-pin-for-partial-run.js';
import type { NodeDebugState, PinDataMap } from './editor-debug-types.js';
import { listPredecessorNodes } from './predecessor-nodes.js';

function isStickyNoteId(definition: WorkflowDefinition, id: string): boolean {
  return definition.nodes.some((n) => n.id === id && n.type === 'stickyNote');
}

function loopBodyRegions(definition: WorkflowDefinition): Map<string, Set<string>> {
  const regions = new Map<string, Set<string>>();
  for (const node of definition.nodes) {
    if (node.type !== 'loop') continue;
    regions.set(node.id, getLoopBodyNodeIds(node.id, definition.connections));
  }
  return regions;
}

function targetLoopBodyMembership(
  targetNodeId: string,
  regions: Map<string, Set<string>>,
): Set<string> {
  const memberOf = new Set<string>();
  for (const [loopId, bodyIds] of regions) {
    if (bodyIds.has(targetNodeId)) memberOf.add(loopId);
  }
  return memberOf;
}

/** 循环体节点不应作为 Loop 自身或 done 下游节点的主流程前序。 */
function excludeLoopBodyPredecessors(
  definition: WorkflowDefinition,
  targetNodeId: string,
  preds: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  const regions = loopBodyRegions(definition);
  if (regions.size === 0) return preds;

  const insideLoops = targetLoopBodyMembership(targetNodeId, regions);

  return preds.filter((pred) => {
    if (pred.id === targetNodeId) return false;
    for (const [loopId, bodyIds] of regions) {
      if (!bodyIds.has(pred.id)) continue;
      if (targetNodeId === loopId) return false;
      if (insideLoops.has(loopId)) continue;
      return false;
    }
    return true;
  });
}

function isIncomingFromLoopBody(
  definition: WorkflowDefinition,
  nodeId: string,
  fromId: string,
): boolean {
  const regions = loopBodyRegions(definition);
  const insideLoops = targetLoopBodyMembership(nodeId, regions);
  for (const [loopId, bodyIds] of regions) {
    if (!bodyIds.has(fromId)) continue;
    if (nodeId === loopId) return true;
    if (insideLoops.has(loopId)) return false;
    return true;
  }
  return false;
}

/** Main-flow ancestors in topological order (excludes target, satellites, resource-only edges). */
export function listMainFlowPredecessorNodes(
  definition: WorkflowDefinition,
  targetNodeId: string,
): Array<{ id: string; name: string }> {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const preds = listPredecessorNodes(definition, targetNodeId).filter((pred) => {
    const node = byId.get(pred.id);
    if (!node || isSatelliteNodeType(node.type)) return false;
    const edge = firstEdgeOnPathToTarget(definition, pred.id, targetNodeId);
    if (!edge) return false;
    const fromOutput = edge.fromOutput ?? 'main';
    return !fromOutput.startsWith('ai_');
  });
  return excludeLoopBodyPredecessors(definition, targetNodeId, preds);
}

/** Immediate main-input predecessor (excludes satellites). */
export function getDirectMainFlowPredecessor(
  definition: WorkflowDefinition,
  nodeId: string,
): { id: string; name: string } | null {
  for (const edge of definition.connections) {
    if (edge.to !== nodeId || isStickyNoteId(definition, edge.from)) continue;
    const toInput = edge.toInput ?? 'main';
    if (toInput !== 'main') continue;
    const fromOutput = edge.fromOutput ?? 'main';
    if (fromOutput.startsWith('ai_')) continue;
    const node = definition.nodes.find((n) => n.id === edge.from);
    if (!node || isSatelliteNodeType(node.type)) continue;
    if (isIncomingFromLoopBody(definition, nodeId, edge.from)) continue;
    return { id: node.id, name: node.name.trim() };
  }
  return null;
}

export function isMainFlowPredecessorExecuted(
  definition: WorkflowDefinition,
  predId: string,
  targetNodeId: string,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
  nodeDebug: Record<string, NodeDebugState>,
): boolean {
  const pin = buildPinForPartialRun(
    definition,
    targetNodeId,
    pinData,
    nodeDebug,
    pinBranchData,
  );
  if (isNodePinnedForPartialRun(pin, predId)) return true;
  const status = nodeDebug[predId]?.status;
  return status === 'success' || status === 'failed';
}

export function isDirectMainFlowPredecessorExecuted(
  definition: WorkflowDefinition,
  nodeId: string,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
  nodeDebug: Record<string, NodeDebugState>,
): boolean {
  const direct = getDirectMainFlowPredecessor(definition, nodeId);
  if (!direct) return false;
  return isMainFlowPredecessorExecuted(
    definition,
    direct.id,
    nodeId,
    pinData,
    pinBranchData,
    nodeDebug,
  );
}

/** Main-flow trigger on the path to target (required to start partial debug). */
export function findMainFlowTriggerOnPath(
  definition: WorkflowDefinition,
  targetNodeId: string,
): { id: string; name: string } | null {
  const mainPreds = listMainFlowPredecessorNodes(definition, targetNodeId);
  const triggerPred = mainPreds.find((pred) => {
    const node = definition.nodes.find((n) => n.id === pred.id);
    return node != null && TRIGGER_TYPES.has(node.type);
  });
  if (triggerPred) return triggerPred;

  const target = definition.nodes.find((n) => n.id === targetNodeId);
  if (target && TRIGGER_TYPES.has(target.type)) {
    return { id: target.id, name: target.name.trim() };
  }
  return null;
}

/** Last main-flow predecessor to run when executing predecessors only (excludes editor node). */
export function getMainFlowPredecessorsRunTarget(
  definition: WorkflowDefinition,
  editorNodeId: string,
): string | null {
  const mainPreds = listMainFlowPredecessorNodes(definition, editorNodeId);
  if (mainPreds.length === 0) return null;
  return mainPreds[mainPreds.length - 1]!.id;
}

/** True when every main-flow predecessor from trigger to target has execution output. */
export function areMainFlowPredecessorsExecuted(
  definition: WorkflowDefinition,
  nodeId: string,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
  nodeDebug: Record<string, NodeDebugState>,
): boolean {
  const mainPreds = listMainFlowPredecessorNodes(definition, nodeId);
  if (mainPreds.length === 0) return false;
  return mainPreds.every((pred) =>
    isMainFlowPredecessorExecuted(
      definition,
      pred.id,
      nodeId,
      pinData,
      pinBranchData,
      nodeDebug,
    ),
  );
}
