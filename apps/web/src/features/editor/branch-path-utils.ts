import type { WorkflowDefinition } from '../../api/client.js';
import type { NodeDebugState, PinDataMap, WorkflowItem } from './editor-debug-types.js';
import { getNodePorts, outputHandleToIndex } from './node-port-defs.js';

export type WorkflowConnection = WorkflowDefinition['connections'][number];

/** First edge from `fromId` toward `targetId` on a main data path (BFS). */
export function firstEdgeOnPathToTarget(
  definition: WorkflowDefinition,
  fromId: string,
  targetId: string,
): WorkflowConnection | undefined {
  if (fromId === targetId) return undefined;

  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const connections = definition.connections.filter(
    (c) => !noteIds.has(c.from) && !noteIds.has(c.to),
  );

  const parent = new Map<string, { edge: WorkflowConnection }>();
  const queue = [fromId];
  const seen = new Set([fromId]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of connections.filter((c) => c.from === cur)) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      parent.set(edge.to, { edge });
      if (edge.to === targetId) {
        let hop = targetId;
        while (hop !== fromId) {
          const p = parent.get(hop)!;
          if (p.edge.from === fromId) return p.edge;
          hop = p.edge.from;
        }
        return edge;
      }
      queue.push(edge.to);
    }
  }
  return undefined;
}

export function itemsOnPathBranch(
  debug: NodeDebugState | undefined,
  edge: WorkflowConnection | undefined,
  definition?: WorkflowDefinition,
): WorkflowItem[] {
  if (debug?.status !== 'success' || !debug.outputItems?.length) return [];
  const predNode = definition?.nodes.find((n) => n.id === edge?.from);
  const idx = outputHandleToIndex(edge?.fromOutput, {
    nodeType: predNode?.type,
    parameters: predNode?.parameters,
    outputIndex: edge?.outputIndex,
  });
  return debug.outputItems[idx] ?? [];
}

export type PinBranchDataMap = Record<string, WorkflowItem[][]>;

export function resolveBranchItems(
  predId: string,
  fromOutput: string | undefined,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
  nodeDebug: Record<string, NodeDebugState>,
  definition?: WorkflowDefinition,
  outputIndex?: number,
  targetNodeId?: string,
): WorkflowItem[] {
  const predNode = definition?.nodes.find((n) => n.id === predId);
  const idx = outputHandleToIndex(fromOutput, {
    nodeType: predNode?.type,
    parameters: predNode?.parameters,
    outputIndex,
  });
  if (predNode?.type === 'loop' && idx === 0 && targetNodeId) {
    const iterations = nodeDebug[targetNodeId]?.loopIterations;
    if (iterations?.length) {
      return iterations.flatMap((iter) => iter.inputItems);
    }
  }
  const branches = pinBranchData[predId] ?? nodeDebug[predId]?.outputItems;
  if (branches?.length) return branches[idx] ?? [];

  const multiOut =
    predNode !== undefined &&
    getNodePorts(predNode.type, predNode.parameters).outputs.length > 1;
  if (multiOut) return [];

  const flat = pinData[predId];
  if (flat?.length) return flat;
  return [];
}

export function mainIncomingConnections(
  definition: WorkflowDefinition,
  nodeId: string,
): WorkflowConnection[] {
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  return definition.connections.filter(
    (c) =>
      c.to === nodeId &&
      !noteIds.has(c.from) &&
      !noteIds.has(c.to) &&
      !(c.fromOutput ?? 'main').startsWith('ai_'),
  );
}

