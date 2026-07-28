import type { WorkflowDefinition } from '../../api/client.js';

const TRIGGER_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
  'subworkflowTrigger',
]);

function topologicalOrder(
  startId: string,
  nodeIds: Set<string>,
  edges: WorkflowDefinition['connections'],
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id) || !nodeIds.has(id)) return;
    visited.add(id);
    for (const pred of edges.filter((e) => e.to === id).map((e) => e.from)) {
      visit(pred);
    }
    order.push(id);
  };

  visit(startId);
  for (const id of nodeIds) {
    if (!visited.has(id)) visit(id);
  }
  return order;
}

/** All executable ancestors of targetNodeId in topological order (excludes target). */
export function listPredecessorNodes(
  definition: WorkflowDefinition,
  targetNodeId: string,
): Array<{ id: string; name: string }> {
  const executable = definition.nodes.filter((n) => n.type !== 'stickyNote');
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const edges = definition.connections.filter(
    (c) => !noteIds.has(c.from) && !noteIds.has(c.to),
  );
  const nodeIds = new Set(executable.map((n) => n.id));

  const ancestorIds = new Set<string>();
  const collectAncestors = (id: string) => {
    for (const e of edges) {
      if (e.to === id && nodeIds.has(e.from) && !ancestorIds.has(e.from)) {
        ancestorIds.add(e.from);
        collectAncestors(e.from);
      }
    }
  };
  collectAncestors(targetNodeId);

  const trigger = executable.find((n) => TRIGGER_TYPES.has(n.type));
  const startId = trigger?.id ?? executable[0]?.id;
  if (!startId) return [];

  const order = topologicalOrder(startId, nodeIds, edges);
  const targetIdx = order.indexOf(targetNodeId);
  const beforeTarget = targetIdx < 0 ? order : order.slice(0, targetIdx);

  const byId = new Map(executable.map((n) => [n.id, n]));
  return beforeTarget
    .filter((id) => ancestorIds.has(id))
    .map((id) => ({ id, name: byId.get(id)!.name.trim() }));
}
