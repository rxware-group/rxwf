import type { WorkflowDefinition } from '../../api/client.js';
import { hasDisallowedWorkflowCycle } from '@rxwf/workflow/graph-cycle';

export function validateConnections(definition: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const nodeIds = new Set(definition.nodes.map((n) => n.id));
  for (const edge of definition.connections) {
    if (noteIds.has(edge.from) || noteIds.has(edge.to)) continue;
    if (!nodeIds.has(edge.from)) {
      errors.push(`Unknown source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Unknown target node: ${edge.to}`);
    }
    if (edge.from === edge.to) {
      errors.push(`Self-loop on node: ${edge.from}`);
    }
  }

  const executableNodes = definition.nodes.filter((n) => !noteIds.has(n.id));
  const executableConnections = definition.connections.filter(
    (c) => !noteIds.has(c.from) && !noteIds.has(c.to),
  );
  if (hasDisallowedWorkflowCycle(executableNodes, executableConnections)) {
    errors.push('Workflow graph contains a cycle');
  }
  return errors;
}
