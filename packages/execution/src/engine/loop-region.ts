import type { WorkflowGraphEdge } from './execution-engine.js';

function reachableFrom(
  startId: string,
  edges: WorkflowGraphEdge[],
  outputIndex?: number,
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const edge of edges) {
    if (edge.from !== startId) continue;
    if (outputIndex !== undefined && (edge.outputIndex ?? 0) !== outputIndex) {
      continue;
    }
    if (!reachable.has(edge.to)) {
      reachable.add(edge.to);
      queue.push(edge.to);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from !== current || reachable.has(edge.to)) continue;
      reachable.add(edge.to);
      queue.push(edge.to);
    }
  }
  return reachable;
}

export interface LoopRegion {
  loopNodeId: string;
  bodyNodeIds: Set<string>;
  bodyEntryIds: string[];
  bodyExitIds: string[];
}

export function computeLoopRegion(
  loopNodeId: string,
  edges: WorkflowGraphEdge[],
): LoopRegion {
  const loopBranch = reachableFrom(loopNodeId, edges, 0);
  const doneBranch = reachableFrom(loopNodeId, edges, 1);
  const bodyNodeIds = new Set<string>();
  for (const id of loopBranch) {
    if (id !== loopNodeId && !doneBranch.has(id)) {
      bodyNodeIds.add(id);
    }
  }

  const bodyEntryIds: string[] = [];
  for (const edge of edges) {
    if (edge.from === loopNodeId && (edge.outputIndex ?? 0) === 0) {
      if (bodyNodeIds.has(edge.to)) bodyEntryIds.push(edge.to);
    }
  }

  const bodyExitIds: string[] = [];
  for (const id of bodyNodeIds) {
    const outEdges = edges.filter((e) => e.from === id);
    const exitsBody = outEdges.some((e) => !bodyNodeIds.has(e.to));
    if (outEdges.length === 0 || exitsBody) {
      bodyExitIds.push(id);
    }
  }

  return {
    loopNodeId,
    bodyNodeIds,
    bodyEntryIds,
    bodyExitIds,
  };
}

export function collectLoopRegions(
  nodes: { id: string; type: string }[],
  edges: WorkflowGraphEdge[],
): Map<string, LoopRegion> {
  const regions = new Map<string, LoopRegion>();
  for (const node of nodes) {
    if (node.type !== 'loop') continue;
    regions.set(node.id, computeLoopRegion(node.id, edges));
  }
  return regions;
}
