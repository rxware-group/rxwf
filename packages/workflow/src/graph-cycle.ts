export type CycleCheckNode = {
  id: string;
  type: string;
};

export type CycleCheckConnection = {
  from: string;
  to: string;
  fromOutput?: string;
  toInput?: string;
  outputIndex?: number;
};

type GraphEdge = {
  from: string;
  to: string;
  outputIndex: number;
};

function connectionOutputIndex(c: CycleCheckConnection): number {
  if (typeof c.outputIndex === 'number') return c.outputIndex;
  if (c.fromOutput == null || c.fromOutput === 'main') return 0;
  const n = Number(c.fromOutput);
  return Number.isNaN(n) ? 0 : n;
}

function toGraphEdges(connections: CycleCheckConnection[]): GraphEdge[] {
  return connections.map((c) => ({
    from: c.from,
    to: c.to,
    outputIndex: connectionOutputIndex(c),
  }));
}

function reachableFrom(
  startId: string,
  edges: GraphEdge[],
  outputIndex?: number,
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const edge of edges) {
    if (edge.from !== startId) continue;
    if (outputIndex !== undefined && edge.outputIndex !== outputIndex) continue;
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

function computeLoopBodyNodeIds(loopNodeId: string, edges: GraphEdge[]): Set<string> {
  const loopBranch = reachableFrom(loopNodeId, edges, 0);
  const doneBranch = reachableFrom(loopNodeId, edges, 1);
  const bodyNodeIds = new Set<string>();
  for (const id of loopBranch) {
    if (id !== loopNodeId && !doneBranch.has(id)) {
      bodyNodeIds.add(id);
    }
  }
  return bodyNodeIds;
}

/** Loop 节点循环体内的节点 id（不含 Loop 自身；不含 done 分支）。 */
export function getLoopBodyNodeIds(
  loopNodeId: string,
  connections: CycleCheckConnection[],
): Set<string> {
  return computeLoopBodyNodeIds(loopNodeId, toGraphEdges(connections));
}

/** Body → Loop re-entry edges are intentional; other cycles remain invalid. */
function allowedLoopBackEdgeKeys(
  nodes: CycleCheckNode[],
  edges: GraphEdge[],
): Set<string> {
  const allowed = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'loop') continue;
    const bodyNodeIds = computeLoopBodyNodeIds(node.id, edges);
    for (const fromId of bodyNodeIds) {
      allowed.add(`${fromId}:${node.id}`);
    }
  }
  return allowed;
}

export function hasDisallowedWorkflowCycle(
  nodes: CycleCheckNode[],
  connections: CycleCheckConnection[],
): boolean {
  const ids = new Set(nodes.map((n) => n.id));
  const edges = toGraphEdges(connections).filter(
    (e) => ids.has(e.from) && ids.has(e.to),
  );
  const allowedBack = allowedLoopBackEdgeKeys(nodes, edges);

  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const edge of edges) {
    if (allowedBack.has(`${edge.from}:${edge.to}`)) continue;
    adj.get(edge.from)!.push(edge.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const id of ids) {
    if (dfs(id)) return true;
  }
  return false;
}
