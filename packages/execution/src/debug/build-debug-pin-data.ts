import type { WorkflowDefinition } from '@rxwf/workflow';
import type { WorkflowItem } from '@rxwf/shared';

export interface NodeRunOutputRow {
  nodeId: string;
  status: string;
  outputData: WorkflowItem[][] | null;
}

/** Topological order of node ids (dependencies first). */
export function topologicalNodeOrder(definition: WorkflowDefinition): string[] {
  const nodes = definition.nodes.filter((n) => !n.disabled);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    indegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of definition.connections) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    adj.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = [...nodeIds].filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indegree.get(next) ?? 1) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  return order.length === nodeIds.size ? order : [...nodeIds];
}

export function buildDebugPinData(
  definition: WorkflowDefinition,
  nodeRuns: NodeRunOutputRow[],
): {
  pinData: Record<string, WorkflowItem[]>;
  failedNodeId?: string;
  skippedNodeIds: string[];
} {
  const byNode = new Map(nodeRuns.map((r) => [r.nodeId, r]));
  const order = topologicalNodeOrder(definition);
  const failed = nodeRuns.find((r) => r.status === 'failed');
  const failedNodeId = failed?.nodeId;
  const failedIndex = failedNodeId ? order.indexOf(failedNodeId) : -1;

  const pinData: Record<string, WorkflowItem[]> = {};
  const skippedNodeIds: string[] = [];

  const limit = failedIndex >= 0 ? failedIndex : order.length;
  for (let i = 0; i < limit; i++) {
    const nodeId = order[i]!;
    const run = byNode.get(nodeId);
    if (!run || run.status !== 'success' || !run.outputData?.length) {
      if (run && run.status === 'success') skippedNodeIds.push(nodeId);
      continue;
    }
    const flat = run.outputData.flat();
    if (flat.length > 0) pinData[nodeId] = flat;
  }

  return { pinData, failedNodeId, skippedNodeIds };
}
