import type {
  AgentStepRecord,
  ExecutionDetail,
  ExecutionNodeRun,
  WorkflowDefinition,
} from '../../api/client.js';
import type {
  AgentStreamLogEntry,
  NodeDebugLogEntry,
  NodeDebugState,
  PinDataMap,
  WorkflowItem,
} from '../editor/editor-debug-types.js';
import { resolveAgentSteps } from './execution-timeline-steps.js';

type WorkflowItemBranch = WorkflowItem[][];

function asWorkflowItems(data: unknown[][] | null | undefined): WorkflowItem[][] | undefined {
  if (!data?.length) return undefined;
  return data as WorkflowItemBranch;
}

function countItems(branches?: WorkflowItem[][]): number {
  if (!branches?.length) return 0;
  return branches.reduce((sum, branch) => sum + branch.length, 0);
}

function topologicalNodeOrder(definition: WorkflowDefinition): string[] {
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

function buildPinDataFromRuns(
  definition: WorkflowDefinition,
  nodeRuns: ExecutionNodeRun[],
): { pinData: PinDataMap; failedNodeId?: string } {
  const byNode = new Map(nodeRuns.map((r) => [r.nodeId, r]));
  const order = topologicalNodeOrder(definition);
  const failed = nodeRuns.find((r) => r.status === 'failed');
  const waiting = nodeRuns.find((r) => r.status === 'waiting');
  const failedNodeId = failed?.nodeId;
  const waitingNodeId = waiting?.nodeId;
  const stopNodeId = waitingNodeId ?? failedNodeId;
  const stopIndex = stopNodeId ? order.indexOf(stopNodeId) : -1;
  const pinData: PinDataMap = {};
  const limit = stopIndex >= 0 ? stopIndex : order.length;

  for (let i = 0; i < limit; i++) {
    const nodeId = order[i]!;
    const run = byNode.get(nodeId);
    const output = asWorkflowItems(run?.outputData ?? null);
    if (!run || run.status !== 'success' || !output?.length) continue;
    const flat = output.flat();
    if (flat.length > 0) pinData[nodeId] = flat;
  }

  return { pinData, failedNodeId };
}

function agentStepsToStream(steps: AgentStepRecord[]): AgentStreamLogEntry[] {
  return steps.map((step) => {
    if (step.type === 'token') {
      return { type: 'token', content: step.content };
    }
    if (step.type === 'tool') {
      return {
        type: step.status === 'running' ? 'tool_start' : 'tool_end',
        tool: step.tool,
        input: step.input,
        output: step.output,
      };
    }
    return { type: 'agent_step', step: step.output ?? step };
  });
}

function nodeRunToDebugState(nr: ExecutionNodeRun, runSeq: number): NodeDebugState {
  const outputItems = asWorkflowItems(nr.outputData ?? null);
  const agentSteps = resolveAgentSteps(nr);
  const metaLogs = nr.metadata?.logs as NodeDebugLogEntry[] | undefined;

  const status =
    nr.status === 'skipped'
      ? 'idle'
      : nr.status === 'waiting'
        ? 'waiting'
        : (nr.status as NodeDebugState['status']);
  return {
    status,
    runSeq,
    durationMs: nr.durationMs,
    itemCount: countItems(outputItems),
    errorMessage: nr.errorCode,
    outputItems,
    logs: metaLogs?.length ? metaLogs : undefined,
    agentStream: agentSteps?.length ? agentStepsToStream(agentSteps) : undefined,
  };
}

export function executionToDebugState(detail: ExecutionDetail): {
  definition: WorkflowDefinition;
  nodeDebug: Record<string, NodeDebugState>;
  pinData: PinDataMap;
  failedNodeId?: string;
} {
  const definition = detail.definitionSnapshot ?? {
    schemaVersion: 1,
    name: '',
    nodes: [],
    connections: [],
  };
  const nodeDebug: Record<string, NodeDebugState> = {};
  for (const [idx, nr] of detail.nodeRuns.entries()) {
    nodeDebug[nr.nodeId] = nodeRunToDebugState(nr, idx + 1);
  }
  const { pinData, failedNodeId } = buildPinDataFromRuns(definition, detail.nodeRuns);
  return { definition, nodeDebug, pinData, failedNodeId };
}
