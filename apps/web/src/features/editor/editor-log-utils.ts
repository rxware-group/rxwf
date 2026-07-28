import type { WorkflowDefinition } from '../../api/client.js';
import {
  findAgentChatModelHub,
  findAgentKnowledgeHub,
  findAgentMemoryHub,
  findAgentOutputParserHub,
  findAgentToolHub,
  isAgentChatModelSatelliteType,
  isAgentKnowledgeSatelliteType,
  isAgentMemorySatelliteType,
  isAgentToolSatelliteType,
  resolveParserInvokePreview,
} from './agent-tool-input-sources.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import { firstEdgeOnPathToTarget } from './branch-path-utils.js';
import {
  getDirectMainFlowPredecessor,
  isSatelliteNodeType,
  listMainFlowPredecessorNodes,
} from './main-flow-predecessors.js';
import type {
  NodeDebugState,
  NodeDebugStatus,
  NodeOutputPreview,
  PinDataMap,
  WorkflowItem,
} from './editor-debug-types.js';
import { itemsForDebugDisplay } from './editor-debug-types.js';
import { getOutputBranchLabels, mapNodeOutputBranches } from './node-port-defs.js';
import {
  backfillChatModelInvocationOutputs,
  buildLlmResponsesFromHubOutputItems,
  listLoopIterations,
  listSatelliteInvocations,
  satelliteInvocationsToOutputItems,
} from './node-debug-run-state.js';
import {
  resolveOutputParserSchemaPreview,
  resolveSchemaFromOutputParserDebug,
} from './output-parser-schema.js';
import { resolvePredecessorItems } from './resolve-predecessor-items.js';
import { resolveKnowledgeQueryFromDebug } from './knowledge-output.js';
import { resolveMemorySnapshotFromDebug } from './memory-output.js';

const EXECUTED_STATUSES: NodeDebugStatus[] = ['running', 'success', 'failed', 'waiting'];

export type ExecutedNodeListEntry = {
  id: string;
  listKey: string;
  name: string;
  type: string;
  status: NodeDebugStatus;
  durationMs?: number;
  iterationRound?: number;
};

function resolveLoopBodyInputPreview(
  debug: NodeDebugState,
  iterationRound?: number | null,
): unknown | null {
  const iterations = listLoopIterations(debug);
  if (!iterations.length) return null;
  if (iterationRound != null) {
    const iter = iterations.find((item) => item.round === iterationRound);
    return iter ? itemsForDebugDisplay(iter.inputItems) : null;
  }
  if (iterations.length === 1) {
    return itemsForDebugDisplay(iterations[0]!.inputItems);
  }
  return iterations.map((iter) => ({
    round: iter.round,
    input: itemsForDebugDisplay(iter.inputItems),
  }));
}

function resolveLoopBodyOutputPreview(
  debug: NodeDebugState,
  iterationRound?: number | null,
): NodeOutputPreview | null {
  const iterations = listLoopIterations(debug);
  if (!iterations.length) return null;
  if (iterationRound != null) {
    const iter = iterations.find((item) => item.round === iterationRound);
    if (!iter?.outputItems) return null;
    const flat = iter.outputItems.flat();
    if (!flat.length) return null;
    return { kind: 'single', data: itemsForDebugDisplay(flat) };
  }
  if (iterations.length === 1) {
    const flat = iterations[0]!.outputItems?.flat() ?? [];
    if (!flat.length) return null;
    return { kind: 'single', data: itemsForDebugDisplay(flat) };
  }
  return {
    kind: 'branches',
    branches: iterations.map((iter) => ({
      label: String(iter.round),
      loopRound: true,
      data: itemsForDebugDisplay(iter.outputItems?.flat() ?? []),
    })),
  };
}

export function listExecutedNodes(
  definition: WorkflowDefinition,
  nodeDebug: Record<string, NodeDebugState>,
  currentRunId?: string,
): ExecutedNodeListEntry[] {
  const nodeIndex = new Map(definition.nodes.map((node, idx) => [node.id, idx]));
  const listed = definition.nodes.flatMap((node) => {
    const debug = nodeDebug[node.id];
    let status = debug?.status;
    if ((!status || status === 'idle') && isSatelliteNodeType(node.type)) {
      const hasSatelliteData =
        (debug?.agentStream?.length ?? 0) > 0 || (debug?.outputItems?.[0]?.length ?? 0) > 0;
      if (hasSatelliteData) {
        status = debug?.status === 'running' ? 'running' : 'success';
      }
    }
    if (!status || !EXECUTED_STATUSES.includes(status)) return [];
    if (currentRunId && debug.runId && debug.runId !== currentRunId) return [];
    if (currentRunId && !debug.runId) return [];
    const loopIterations = listLoopIterations(debug);
    if (loopIterations.length > 1) {
      return loopIterations.map((iter) => ({
        id: node.id,
        listKey: `${node.id}:round:${iter.round}`,
        name: `${node.name} (${iter.round}/${loopIterations.length})`,
        type: node.type,
        status,
        durationMs: iter.durationMs ?? debug.durationMs,
        iterationRound: iter.round,
        runSeq: debug.runSeq,
      }));
    }
    return [
      {
        id: node.id,
        listKey: node.id,
        name: node.name,
        type: node.type,
        status,
        durationMs: debug.durationMs,
        runSeq: debug.runSeq,
      },
    ];
  });
  listed.sort((a, b) => {
    const aHasSeq = a.runSeq != null;
    const bHasSeq = b.runSeq != null;
    if (aHasSeq && bHasSeq) return (a.runSeq as number) - (b.runSeq as number);
    if (aHasSeq !== bHasSeq) return aHasSeq ? -1 : 1;
    const aRound = a.iterationRound ?? 0;
    const bRound = b.iterationRound ?? 0;
    if (aRound !== bRound) return aRound - bRound;
    return (nodeIndex.get(a.id) ?? 0) - (nodeIndex.get(b.id) ?? 0);
  });
  return listed.map(({ runSeq: _runSeq, ...node }) => node);
}

function resolveSatelliteInputPreview(debug?: NodeDebugState): unknown | null {
  const invocations = listSatelliteInvocations(debug);
  if (!invocations.length) return null;
  if (invocations.length === 1) return invocations[0]?.input ?? null;
  return invocations.map((inv, index) => ({
    round: index + 1,
    input: inv.input,
  }));
}

function extractChatModelAnswer(output: unknown): unknown | null {
  if (output === undefined || output === null) return null;
  if (typeof output === 'string') return output.trim() ? output : null;
  if (typeof output === 'object' && 'content' in output) {
    const content = (output as { content?: unknown }).content;
    if (typeof content === 'string') return content.trim() ? content : null;
    if (content !== undefined && content !== null) return content;
  }
  return null;
}

function satelliteInvocationOutputData(
  inv: ReturnType<typeof listSatelliteInvocations>[number],
  options?: { chatModel?: boolean },
): unknown {
  if (options?.chatModel) {
    if (inv.error) return { error: inv.error };
    const answer = extractChatModelAnswer(inv.output);
    return answer ?? null;
  }
  if (inv.error) {
    return {
      error: inv.error,
      ...(inv.durationMs != null ? { durationMs: inv.durationMs } : {}),
    };
  }
  if (inv.output !== undefined) return inv.output;
  return inv.durationMs != null ? { durationMs: inv.durationMs } : null;
}

function resolveSatelliteOutputPreview(
  debug?: NodeDebugState,
  options?: { chatModel?: boolean },
): NodeOutputPreview | null {
  const invocations = listSatelliteInvocations(debug);
  if (!invocations.length) return null;
  const data = invocations.flatMap((inv) => {
    const item = satelliteInvocationOutputData(inv, options);
    return item === null ? [] : [item];
  });
  if (!data.length) return null;
  return { kind: 'single', data };
}

/** Structured failure details for log panel / node editor output. */
export function resolveNodeErrorPreview(
  debug: NodeDebugState,
): Record<string, unknown> | null {
  const detail: Record<string, unknown> = {};
  if (debug.errorCode) detail.code = debug.errorCode;
  if (debug.errorMessage?.trim()) detail.message = debug.errorMessage;

  const invocations = listSatelliteInvocations(debug);
  const failedInvocations = invocations.flatMap((inv, index) => {
    if (!inv.error?.trim()) return [];
    return [
      {
        ...(invocations.length > 1 ? { round: index + 1 } : {}),
        error: inv.error,
        ...(inv.output !== undefined ? { output: inv.output } : {}),
        ...(inv.durationMs != null ? { durationMs: inv.durationMs } : {}),
      },
    ];
  });
  if (failedInvocations.length) detail.invocations = failedInvocations;

  const errorLogs = debug.logs
    ?.filter((entry) => entry.level === 'error')
    .map((entry) => ({
      time: entry.timestamp,
      message: entry.message,
    }));
  if (errorLogs?.length) detail.logs = errorLogs;

  const agentStreamErrors = debug.agentStream?.flatMap((entry) => {
    if (entry.error?.trim()) {
      return [
        {
          type: entry.type,
          error: entry.error,
          ...(entry.tool ? { tool: entry.tool } : {}),
        },
      ];
    }
    if (entry.type === 'agent_step' && entry.step && typeof entry.step === 'object') {
      const step = entry.step as Record<string, unknown>;
      if (typeof step.error === 'string' && step.error.trim()) {
        return [
          {
            type: entry.type,
            step: entry.step,
          },
        ];
      }
    }
    return [];
  });
  if (agentStreamErrors?.length) detail.agentStream = agentStreamErrors;

  return Object.keys(detail).length > 0 ? detail : null;
}

export function resolveDebugOutputItems(
  definition: WorkflowDefinition,
  nodeId: string,
  nodeDebug: Record<string, NodeDebugState>,
): WorkflowItem[][] | undefined {
  const debug = nodeDebug[nodeId];
  if (!debug) return undefined;
  const node = definition.nodes.find((n) => n.id === nodeId);
  if (node?.type === 'aiOutputParser') {
    if (debug.outputItems?.[0]?.length) return debug.outputItems;
    const schema = resolveSchemaFromOutputParserDebug(debug);
    return schema !== null ? [[{ json: { schema } }]] : undefined;
  }
  if (node?.type === 'aiMemory') {
    if (debug.outputItems?.[0]?.length) return debug.outputItems;
    const snapshot = resolveMemorySnapshotFromDebug(debug);
    return snapshot ? [[{ json: snapshot }]] : undefined;
  }
  if (node?.type === 'aiKnowledge') {
    if (debug.outputItems?.[0]?.length) return debug.outputItems;
    const queryResult = resolveKnowledgeQueryFromDebug(debug);
    return queryResult != null ? [[{ json: queryResult as Record<string, unknown> }]] : undefined;
  }
  if (node && isSatelliteNodeType(node.type)) {
    if (debug.outputItems?.[0]?.length) return debug.outputItems;
    const items = satelliteInvocationsToOutputItems(debug);
    return items.length ? [items] : undefined;
  }
  return debug.outputItems;
}

function resolveAgentHubUpstreamPreview(
  definition: WorkflowDefinition,
  hubId: string,
  pinData: PinDataMap,
  nodeDebug: Record<string, NodeDebugState>,
): unknown {
  const mainPredecessors = listMainFlowPredecessorNodes(definition, hubId);
  const direct = getDirectMainFlowPredecessor(definition, hubId);
  const targetPred = direct ?? mainPredecessors[mainPredecessors.length - 1];
  if (!targetPred) return null;
  const edge = firstEdgeOnPathToTarget(definition, targetPred.id, hubId);
  const items = resolvePredecessorItems(
    targetPred.id,
    pinData,
    nodeDebug,
    edge?.fromOutput,
    {},
    definition,
  );
  const displayed = itemsForDebugDisplay(items);
  return displayed.length ? displayed : null;
}

export function resolveNodeInputPreview(
  definition: WorkflowDefinition,
  nodeId: string,
  pinData: PinDataMap,
  nodeDebug: Record<string, NodeDebugState>,
  iterationRound?: number | null,
  pinBranchData: PinBranchDataMap = {},
): unknown {
  const node = definition.nodes.find((n) => n.id === nodeId);
  if (node?.type === 'aiOutputParser') {
    const hub = findAgentOutputParserHub(definition, nodeId);
    const parserInvoke = resolveParserInvokePreview(nodeDebug[nodeId]);
    const agentUpstream = hub
      ? resolveAgentHubUpstreamPreview(definition, hub.id, pinData, nodeDebug)
      : null;
    if (agentUpstream !== null || parserInvoke !== null) {
      return { agentUpstream, parserInvoke };
    }
    return null;
  }
  if (node && isAgentToolSatelliteType(node.type)) {
    const hub = findAgentToolHub(definition, nodeId);
    const toolArguments = resolveSatelliteInputPreview(nodeDebug[nodeId]);
    const agentUpstream = hub
      ? resolveAgentHubUpstreamPreview(definition, hub.id, pinData, nodeDebug)
      : null;
    if (agentUpstream !== null || toolArguments !== null) {
      return { agentUpstream, toolArguments };
    }
    return null;
  }
  if (node && isAgentChatModelSatelliteType(node.type)) {
    const hub = findAgentChatModelHub(definition, nodeId);
    const modelPrompt = resolveSatelliteInputPreview(nodeDebug[nodeId]);
    const agentUpstream = hub
      ? resolveAgentHubUpstreamPreview(definition, hub.id, pinData, nodeDebug)
      : null;
    if (agentUpstream !== null || modelPrompt !== null) {
      return { agentUpstream, modelPrompt };
    }
    return null;
  }
  if (node && isAgentMemorySatelliteType(node.type)) {
    const hub = findAgentMemoryHub(definition, nodeId);
    const agentUpstream = hub
      ? resolveAgentHubUpstreamPreview(definition, hub.id, pinData, nodeDebug)
      : null;
    if (agentUpstream !== null) {
      return { agentUpstream };
    }
    return null;
  }
  if (node && isAgentKnowledgeSatelliteType(node.type)) {
    const hub = findAgentKnowledgeHub(definition, nodeId);
    const agentUpstream = hub
      ? resolveAgentHubUpstreamPreview(definition, hub.id, pinData, nodeDebug)
      : null;
    if (agentUpstream !== null) {
      return { agentUpstream };
    }
    return null;
  }
  if (node && isSatelliteNodeType(node.type)) {
    const satelliteInput = resolveSatelliteInputPreview(nodeDebug[nodeId]);
    if (satelliteInput !== null) return satelliteInput;
  }
  const loopBodyInput = resolveLoopBodyInputPreview(nodeDebug[nodeId], iterationRound);
  if (loopBodyInput !== null) return loopBodyInput;
  if (node?.type === 'webhookTrigger' || node?.type === 'manualTrigger') {
    const body = node.parameters.body;
    if (body != null && typeof body === 'object' && Object.keys(body as object).length > 0) {
      return itemsForDebugDisplay([{ json: body as Record<string, unknown> }]);
    }
  }
  const storedPreview = nodeDebug[nodeId]?.inputPreview;
  if (storedPreview?.length) {
    return itemsForDebugDisplay(storedPreview);
  }
  const incoming = definition.connections.filter((c) => c.to === nodeId);
  const resolved = incoming.flatMap((c) =>
    resolvePredecessorItems(
      c.from,
      pinData,
      nodeDebug,
      c.fromOutput,
      pinBranchData,
      definition,
      nodeId,
    ),
  );
  if (resolved.length) return itemsForDebugDisplay(resolved);
  return null;
}

export function resolveNodeOutputPreview(
  definition: WorkflowDefinition,
  nodeId: string,
  nodeDebug: Record<string, NodeDebugState>,
  iterationRound?: number | null,
): NodeOutputPreview | null {
  const debug = nodeDebug[nodeId];
  const node = definition.nodes.find((n) => n.id === nodeId);
  if (node?.type === 'aiOutputParser') {
    return resolveOutputParserSchemaPreview(node, debug);
  }
  if (node?.type === 'aiMemory') {
    const snapshot = resolveMemorySnapshotFromDebug(debug);
    if (!snapshot) return null;
    return { kind: 'single', data: [snapshot] };
  }
  if (node?.type === 'aiKnowledge') {
    const queryResult = resolveKnowledgeQueryFromDebug(debug);
    if (queryResult == null) return null;
    return { kind: 'single', data: [queryResult] };
  }
  if (node && isSatelliteNodeType(node.type)) {
    let satelliteDebug = debug;
    if (node.type === 'aiChatModel' && debug) {
      const hub = findAgentChatModelHub(definition, nodeId);
      const hubItems = hub ? nodeDebug[hub.id]?.outputItems?.[0] : undefined;
      const llmResponses = buildLlmResponsesFromHubOutputItems(hubItems);
      if (llmResponses.length > 0) {
        satelliteDebug = backfillChatModelInvocationOutputs(debug, llmResponses);
      }
    }
    return resolveSatelliteOutputPreview(satelliteDebug, {
      chatModel: node.type === 'aiChatModel',
    });
  }
  const loopBodyOutput = resolveLoopBodyOutputPreview(debug, iterationRound);
  if (loopBodyOutput !== null) return loopBodyOutput;
  if (!debug?.outputItems) return null;

  const branchLabels =
    node && debug.outputItems.length > 1
      ? getOutputBranchLabels(node.type, node.parameters)
      : [];

  if (branchLabels.length > 1 && debug.outputItems.length > 1) {
    const branches =
      node != null
        ? mapNodeOutputBranches(node.type, node.parameters, debug.outputItems)
        : branchLabels.map((label, index) => ({
            label,
            branchIndex: index,
            items: debug.outputItems?.[index] ?? [],
          }));
    return {
      kind: 'branches',
      branches: branches.map((branch) => ({
        label: branch.label,
        data: itemsForDebugDisplay(branch.items),
      })),
    };
  }

  const flat = debug.outputItems.flat();
  if (!flat.length) return null;
  return { kind: 'single', data: itemsForDebugDisplay(flat) };
}

const LOG_TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
};

/** 将 ISO 时间戳格式化为浏览器本地时间显示（精确到毫秒） */
export function formatLogTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, LOG_TIMESTAMP_OPTIONS);
}
