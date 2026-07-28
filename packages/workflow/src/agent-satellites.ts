import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export const SATELLITE_NODE_TYPES = new Set([
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
  'toolSkill',
  'toolSubagent',
  'toolRead',
  'toolWrite',
  'toolGrep',
  'toolShell',
  'toolWebSearch',
]);

export const AI_AGENT_CONNECTION_INPUTS = new Set([
  'ai_languageModel',
  'ai_memory',
  'ai_knowledge',
  'ai_outputParser',
  'ai_tool',
]);

export function isSatelliteNodeType(type: string): boolean {
  return SATELLITE_NODE_TYPES.has(type);
}

export interface AgentSatellites {
  model: WorkflowNode | null;
  memory: WorkflowNode | null;
  knowledge: WorkflowNode | null;
  outputParser: WorkflowNode | null;
  tools: WorkflowNode[];
  instructions: WorkflowNode[];
}

/** Tools wired into a `toolSubagent` hub (ai_tool → toolSubagent). */
export function collectSubagentSatellites(
  definition: WorkflowDefinition,
  hubNodeId: string,
): WorkflowNode[] {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const tools: WorkflowNode[] = [];
  for (const c of definition.connections) {
    if (c.to !== hubNodeId || c.toInput !== 'ai_tool') continue;
    const from = byId.get(c.from);
    if (from) tools.push(from);
  }
  return tools;
}

/** Rule / instruction satellites (ai_instruction → skillRun / aiAgent). */
export function collectInstructionSources(
  definition: WorkflowDefinition,
  targetNodeId: string,
): WorkflowNode[] {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const sources: WorkflowNode[] = [];
  for (const c of definition.connections) {
    if (c.to !== targetNodeId) continue;
    const input = c.toInput ?? 'main';
    if (input !== 'ai_instruction') continue;
    const from = byId.get(c.from);
    if (from) sources.push(from);
  }
  return sources;
}

export function collectSatellites(
  definition: WorkflowDefinition,
  agentNodeId: string,
): AgentSatellites {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  let model: WorkflowNode | null = null;
  let memory: WorkflowNode | null = null;
  let knowledge: WorkflowNode | null = null;
  let outputParser: WorkflowNode | null = null;
  const tools: WorkflowNode[] = [];
  const instructions: WorkflowNode[] = [];

  for (const c of definition.connections) {
    if (c.to !== agentNodeId) continue;
    const from = byId.get(c.from);
    if (!from) continue;
    const input = c.toInput ?? 'main';
    if (input === 'ai_languageModel') model = from;
    else if (input === 'ai_memory') memory = from;
    else if (input === 'ai_knowledge') knowledge = from;
    else if (input === 'ai_outputParser') outputParser = from;
    else if (input === 'ai_tool') tools.push(from);
    else if (input === 'ai_instruction') instructions.push(from);
  }

  return { model, memory, knowledge, outputParser, tools, instructions };
}
