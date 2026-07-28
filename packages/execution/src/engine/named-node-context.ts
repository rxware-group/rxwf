import type { WorkflowItem } from '@rxwf/shared';
import type { NodeOutputEntry } from '@rxwf/expression';

/** Build preceding nodes' outputs for all nodes executed before currentNodeId in topological order. */
export function buildNodesContext(
  order: string[],
  currentNodeId: string,
  idToName: Map<string, string>,
  outputs: Map<string, WorkflowItem[][]>,
): NodeOutputEntry[] {
  const idx = order.indexOf(currentNodeId);
  const ancestors = idx < 0 ? order : order.slice(0, idx);
  const entries: NodeOutputEntry[] = [];
  for (const nodeId of ancestors) {
    const name = idToName.get(nodeId);
    if (!name) continue;
    const items = outputs.get(nodeId)?.[0] ?? [];
    const first = items[0];
    entries.push({
      name,
      items,
      json: first?.json ?? {},
    });
  }
  return entries;
}
