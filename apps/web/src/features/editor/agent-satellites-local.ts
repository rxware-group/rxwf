import type { WorkflowDefinition } from '../../api/client.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];

export function collectSatellitesLocal(
  definition: WorkflowDefinition,
  agentNodeId: string,
): {
  model: WorkflowNode | null;
  memory: WorkflowNode | null;
  knowledge: WorkflowNode | null;
  tools: WorkflowNode[];
} {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  let model: WorkflowNode | null = null;
  let memory: WorkflowNode | null = null;
  let knowledge: WorkflowNode | null = null;
  const tools: WorkflowNode[] = [];

  for (const c of definition.connections) {
    if (c.to !== agentNodeId) continue;
    const from = byId.get(c.from);
    if (!from) continue;
    const input = c.toInput ?? 'main';
    if (input === 'ai_languageModel') model = from;
    else if (input === 'ai_memory') memory = from;
    else if (input === 'ai_knowledge') knowledge = from;
    else if (input === 'ai_tool') tools.push(from);
  }

  return { model, memory, knowledge, tools };
}
