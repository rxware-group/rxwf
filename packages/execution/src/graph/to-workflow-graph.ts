import { AwfError } from '@rxwf/shared';
import {
  AI_AGENT_CONNECTION_INPUTS,
  isCrewOrchestrationConnection,
  isGroupChatOrchestrationConnection,
  isSatelliteNodeType,
  switchBranchIndex,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@rxwf/workflow';
import type { WorkflowGraph } from '../engine/execution-engine.js';

function edgeOutputIndex(
  edge: WorkflowDefinition['connections'][number],
  fromNode?: WorkflowNode,
): number {
  if (fromNode?.type === 'switch') {
    return switchBranchIndex(
      fromNode.parameters,
      edge.fromOutput,
      edge.outputIndex,
    );
  }
  if (typeof edge.outputIndex === 'number' && edge.outputIndex >= 0) {
    return edge.outputIndex;
  }
  const out = edge.fromOutput ?? 'main';
  if (out === 'main') return 0;
  const n = Number(out);
  if (!Number.isNaN(n) && n >= 0) return n;
  if (out === 'true') return 0;
  if (out === 'false') return 1;
  return 0;
}

const TRIGGER_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
  'subworkflowTrigger',
]);

const NODE_TYPE_ALIASES: Record<string, string> = {
  manualtrigger: 'manualTrigger',
};

function normalizeNodeType(type: string): string {
  return NODE_TYPE_ALIASES[type] ?? NODE_TYPE_ALIASES[type.toLowerCase()] ?? type;
}

function isExecutableNode(type: string): boolean {
  return type !== 'stickyNote';
}

const AI_SATELLITE_OUTPUTS = new Set([
  'ai_languageModel',
  'ai_memory',
  'ai_tool',
]);

function participatesInMainFlow(
  nodeId: string,
  connections: WorkflowDefinition['connections'],
): boolean {
  for (const c of connections) {
    const toInput = c.toInput ?? 'main';
    const fromOutput = c.fromOutput ?? 'main';
    if (c.to === nodeId && toInput === 'main') return true;
    if (c.from === nodeId && fromOutput === 'main') return true;
  }
  return false;
}

function isAiSatelliteConnection(
  connection: WorkflowDefinition['connections'][number],
): boolean {
  const toInput = connection.toInput ?? 'main';
  const fromOutput = connection.fromOutput ?? 'main';
  return (
    AI_AGENT_CONNECTION_INPUTS.has(toInput) || AI_SATELLITE_OUTPUTS.has(fromOutput)
  );
}

export function toWorkflowGraph(definition: WorkflowDefinition): {
  graph: WorkflowGraph;
  startNodeId: string;
} {
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const connections = definition.connections.filter(
    (c) => !noteIds.has(c.from) && !noteIds.has(c.to),
  );

  const executable = definition.nodes.filter((n) => {
    if (!isExecutableNode(n.type)) return false;
    if (isSatelliteNodeType(n.type) && !participatesInMainFlow(n.id, connections)) {
      return false;
    }
    return true;
  });
  const executableIds = new Set(executable.map((n) => n.id));
  const nodeById = new Map(executable.map((n) => [n.id, n]));
  const mainConnections = connections.filter(
    (c) =>
      executableIds.has(c.from) &&
      executableIds.has(c.to) &&
      !isAiSatelliteConnection(c) &&
      !isCrewOrchestrationConnection(c) &&
      !isGroupChatOrchestrationConnection(c),
  );

  const trigger = executable.find((n) =>
    TRIGGER_TYPES.has(normalizeNodeType(n.type)),
  );
  const startNodeId = trigger?.id ?? executable[0]?.id;
  if (!startNodeId) {
    throw new AwfError('E1003', 'Workflow has no executable start node');
  }

  return {
    startNodeId,
    graph: {
      startNodeId,
      nodes: executable.map((node) => ({
        id: node.id,
        name: node.name.trim(),
        type: normalizeNodeType(node.type),
        config: node.parameters,
      })),
      edges: mainConnections.map((edge) => ({
        from: edge.from,
        to: edge.to,
        outputIndex: edgeOutputIndex(edge, nodeById.get(edge.from)),
      })),
    },
  };
}
