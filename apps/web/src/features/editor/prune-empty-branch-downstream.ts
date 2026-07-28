import type { WorkflowDefinition } from '../../api/client.js';
import {
  mainIncomingConnections,
  resolveBranchItems,
  type PinBranchDataMap,
} from './branch-path-utils.js';
import type { NodeDebugState, PinDataMap, WorkflowItem } from './editor-debug-types.js';
import { outputHandleToIndex } from './node-port-defs.js';

type WorkflowConnection = WorkflowDefinition['connections'][number];

function isMainDataConnection(c: WorkflowConnection): boolean {
  const fromOutput = c.fromOutput ?? 'main';
  return !fromOutput.startsWith('ai_');
}

function mainOutgoingConnections(
  definition: WorkflowDefinition,
  nodeId: string,
): WorkflowConnection[] {
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  return definition.connections.filter(
    (c) =>
      c.from === nodeId &&
      !noteIds.has(c.from) &&
      !noteIds.has(c.to) &&
      isMainDataConnection(c),
  );
}

function resolveItemsForEdge(
  conn: WorkflowConnection,
  knownOutputs: Map<string, WorkflowItem[][]>,
  nodeDebug: Record<string, NodeDebugState>,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
  definition: WorkflowDefinition,
): WorkflowItem[] {
  const fromId = conn.from;
  const fromNode = definition.nodes.find((n) => n.id === fromId);
  const handleCtx = {
    nodeType: fromNode?.type,
    parameters: fromNode?.parameters,
    outputIndex: conn.outputIndex,
  };
  const branches = knownOutputs.get(fromId);
  if (branches?.length) {
    const idx = outputHandleToIndex(conn.fromOutput, handleCtx);
    return branches[idx] ?? [];
  }
  return resolveBranchItems(
    fromId,
    conn.fromOutput,
    pinData,
    pinBranchData,
    nodeDebug,
    definition,
    conn.outputIndex,
  );
}

function nodeHasNoIncomingItems(
  definition: WorkflowDefinition,
  nodeId: string,
  knownOutputs: Map<string, WorkflowItem[][]>,
  nodeDebug: Record<string, NodeDebugState>,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
): boolean {
  const incoming = mainIncomingConnections(definition, nodeId);
  if (incoming.length === 0) return false;
  return incoming.every(
    (conn) =>
      resolveItemsForEdge(conn, knownOutputs, nodeDebug, pinData, pinBranchData, definition)
        .length === 0,
  );
}

export type PruneDownstreamMaps = {
  nodeDebug: Record<string, NodeDebugState>;
  pinData: PinDataMap;
  pinBranchData: PinBranchDataMap;
};

/**
 * Remove debug (and pin) for downstream nodes fed only by empty branches from a source run.
 */
export function pruneEmptyBranchDownstream(
  definition: WorkflowDefinition,
  sourceNodeId: string,
  outputItems: WorkflowItem[][],
  nodeDebug: Record<string, NodeDebugState>,
  pinData: PinDataMap = {},
  pinBranchData: PinBranchDataMap = {},
): PruneDownstreamMaps {
  const nextDebug = { ...nodeDebug };
  const nextPinData = { ...pinData };
  const nextPinBranch = { ...pinBranchData };
  const knownOutputs = new Map<string, WorkflowItem[][]>();
  knownOutputs.set(sourceNodeId, outputItems);

  const queue: string[] = [];
  const seen = new Set<string>();

  const sourceNode = definition.nodes.find((n) => n.id === sourceNodeId);
  const sourceCtx = {
    nodeType: sourceNode?.type,
    parameters: sourceNode?.parameters,
  };
  for (const edge of mainOutgoingConnections(definition, sourceNodeId)) {
    const idx = outputHandleToIndex(edge.fromOutput, {
      ...sourceCtx,
      outputIndex: edge.outputIndex,
    });
    // Loop 的 loop 出口（0）执行后恒为空；循环体已在迭代中跑过，不应据此清掉其 debug。
    if (sourceNode?.type === 'loop' && idx === 0) continue;
    if ((outputItems[idx]?.length ?? 0) === 0 && !seen.has(edge.to)) {
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (
      !nodeHasNoIncomingItems(
        definition,
        nodeId,
        knownOutputs,
        nextDebug,
        nextPinData,
        nextPinBranch,
      )
    ) {
      continue;
    }

    delete nextDebug[nodeId];
    delete nextPinData[nodeId];
    delete nextPinBranch[nodeId];
    knownOutputs.set(nodeId, [[]]);

    for (const edge of mainOutgoingConnections(definition, nodeId)) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return {
    nodeDebug: nextDebug,
    pinData: nextPinData,
    pinBranchData: nextPinBranch,
  };
}
