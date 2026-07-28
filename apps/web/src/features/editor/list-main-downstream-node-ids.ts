import type { WorkflowDefinition } from '../../api/client.js';

export function listMainDownstreamNodeIds(
  definition: WorkflowDefinition,
  sourceNodeId: string,
): string[] {
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const queue = [sourceNodeId];
  const seen = new Set<string>([sourceNodeId]);
  const downstream: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of definition.connections) {
      const fromOutput = edge.fromOutput ?? 'main';
      if (
        edge.from !== current ||
        noteIds.has(edge.from) ||
        noteIds.has(edge.to) ||
        fromOutput.startsWith('ai_') ||
        seen.has(edge.to)
      ) {
        continue;
      }
      seen.add(edge.to);
      downstream.push(edge.to);
      queue.push(edge.to);
    }
  }

  return downstream;
}
