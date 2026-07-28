import type { WorkflowDefinition } from '../../api/client.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import { resolveBranchItems } from './branch-path-utils.js';
import type { NodeDebugState, PinDataMap, WorkflowItem } from './editor-debug-types.js';

/** 上游节点在指定输出支路上的 items（pin / debug 分支感知）。 */
export function resolvePredecessorItems(
  predId: string,
  pinData: PinDataMap,
  nodeDebug: Record<string, NodeDebugState>,
  fromOutput?: string | null,
  pinBranchData: PinBranchDataMap = {},
  definition?: WorkflowDefinition,
  targetNodeId?: string,
): WorkflowItem[] {
  return resolveBranchItems(
    predId,
    fromOutput ?? 'main',
    pinData,
    pinBranchData,
    nodeDebug,
    definition,
    undefined,
    targetNodeId,
  );
}
