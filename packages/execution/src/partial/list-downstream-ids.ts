import type { GraphEdge } from './partial-planner.js';

/** Downstream node ids reachable via main data edges, in topological order. */
export function listDownstreamIdsInTopologicalOrder(
  edges: GraphEdge[],
  seedNodeIds: string[],
): string[] {
  const seeds = new Set(seedNodeIds);
  const downstream = new Set<string>();
  const queue: string[] = [];

  for (const seed of seeds) {
    for (const edge of edges) {
      if (edge.from === seed && !downstream.has(edge.to)) {
        downstream.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of edges) {
      if (edge.from !== cur || downstream.has(edge.to)) continue;
      downstream.add(edge.to);
      queue.push(edge.to);
    }
  }

  const order: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || !downstream.has(id)) return;
    visited.add(id);
    order.push(id);
    for (const edge of edges) {
      if (edge.from === id && downstream.has(edge.to)) visit(edge.to);
    }
  };
  for (const seed of seeds) {
    for (const edge of edges) {
      if (edge.from === seed && downstream.has(edge.to)) visit(edge.to);
    }
  }
  return order;
}
