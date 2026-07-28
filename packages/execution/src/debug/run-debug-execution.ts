import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { SandboxLogEntry } from '@rxwf/sandbox';
import type { WorkflowItem } from '@rxwf/shared';
import { AwfError, formatErrorDetail } from '@rxwf/shared';
import { shouldTrackAgentSteps, type WorkflowDefinition } from '@rxwf/workflow';
import type { FacadeNodeRunResult, NodeRunJob } from '../engine/execution-engine.js';
import { buildNodesContext } from '../engine/named-node-context.js';
import { shouldSkipEmptyInput } from '../engine/should-skip-empty-input.js';
import { resolveNodeRunRunnerContext } from '../runner/resolve-node-run-runner.js';
import { toWorkflowGraph } from '../graph/to-workflow-graph.js';
import { listDownstreamIdsInTopologicalOrder } from '../partial/list-downstream-ids.js';
import {
  listUpstreamIdsInTopologicalOrder,
  planPartialExecution,
} from '../partial/partial-planner.js';
import { resolveErrorPayloadFromNodeConfig } from '../error-workflow/error-payload.js';
import { mirrorSatelliteStreamForHub } from './mirror-hub-agent-stream.js';
import { collectLoopRegions } from '../engine/loop-region.js';
import {
  collectLoopBodyNodeIds,
  resolveScopedNodeInput,
  runLoopIterations,
  shouldSkipScopedNodeInput,
  type ScopedNodeInputScope,
} from '../engine/loop-execution.js';

const TRIGGER_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
]);

const NODE_TYPE_ALIASES: Record<string, string> = {
  manualtrigger: 'manualTrigger',
};

function normalizeNodeType(type: string): string {
  return NODE_TYPE_ALIASES[type] ?? NODE_TYPE_ALIASES[type.toLowerCase()] ?? type;
}

export interface DebugNodeResult {
  status: 'success' | 'failed' | 'skipped' | 'waiting';
  outputItems?: WorkflowItem[][];
  errorCode?: string;
  errorMessage?: string;
  itemCount: number;
  durationMs?: number;
  logs?: SandboxLogEntry[];
  agentStream?: AiStreamChunk[];
  loopIteration?: {
    round: number;
    totalRounds: number;
    inputItems: WorkflowItem[];
  };
  loopIterationCount?: number;
  loopBatchItemCount?: number;
  inputItems?: WorkflowItem[];
}

export interface RunDebugExecutionInput {
  definition: WorkflowDefinition;
  targetNodeId: string;
  pinData?: Record<string, WorkflowItem[]>;
  pinBranchData?: Record<string, WorkflowItem[][]>;
  /** Trigger node id → request payload (e.g. webhook test listen). */
  triggerInputs?: Record<string, WorkflowItem[]>;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  /** When omitted, uses an ephemeral id (not persisted). */
  executionId?: string;
  executeNodeRun: (job: NodeRunJob) => Promise<FacadeNodeRunResult>;
  onNodeResult?: (nodeId: string, result: DebugNodeResult) => void;
  onNodeStarted?: (nodeId: string) => void;
  onAgentStream?: (nodeId: string, chunk: AiStreamChunk) => void;
  locale?: string;
}

function buildNodeInput(
  nodeId: string,
  nodeType: string,
  incoming: { from: string; outputIndex?: number }[],
  outputs: Map<string, WorkflowItem[][]>,
  triggerInputs?: Record<string, WorkflowItem[]>,
): { inputItems: WorkflowItem[]; inputBranches: WorkflowItem[][] | undefined } {
  if (incoming.length === 0) {
    if (TRIGGER_TYPES.has(nodeType)) {
      const custom = triggerInputs?.[nodeId];
      if (custom?.length) {
        return { inputItems: custom, inputBranches: undefined };
      }
      return { inputItems: [{ json: {} }], inputBranches: undefined };
    }
    return { inputItems: [], inputBranches: undefined };
  }

  const branches: WorkflowItem[][] = [];
  for (const edge of incoming) {
    const predOutputs = outputs.get(edge.from);
    const idx = edge.outputIndex ?? 0;
    branches.push(predOutputs?.[idx] ?? []);
  }
  if (nodeType === 'merge') {
    return { inputItems: [], inputBranches: branches };
  }
  return { inputItems: branches.flat(), inputBranches: undefined };
}

function emitSkipped(
  nodeId: string,
  nodeResults: Record<string, DebugNodeResult>,
  outputs: Map<string, WorkflowItem[][]>,
  onNodeResult?: (nodeId: string, result: DebugNodeResult) => void,
): void {
  const skipped: DebugNodeResult = {
    status: 'skipped',
    itemCount: 0,
    outputItems: [[]],
  };
  nodeResults[nodeId] = skipped;
  onNodeResult?.(nodeId, skipped);
  outputs.set(nodeId, [[]]);
}

function propagateSkippedDownstream(
  graph: { nodes: { id: string; type: string }[]; edges: { from: string; to: string; outputIndex?: number }[] },
  seedNodeIds: string[],
  outputs: Map<string, WorkflowItem[][]>,
  nodeResults: Record<string, DebugNodeResult>,
  onNodeResult?: (nodeId: string, result: DebugNodeResult) => void,
): void {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const downstreamIds = listDownstreamIdsInTopologicalOrder(graph.edges, seedNodeIds);

  for (const nodeId of downstreamIds) {
    if (nodeResults[nodeId]) continue;

    const node = nodeById.get(nodeId);
    if (!node) continue;

    const incoming = graph.edges.filter((e) => e.to === nodeId);
    const { inputItems, inputBranches } = buildNodeInput(
      nodeId,
      node.type,
      incoming,
      outputs,
    );

    if (
      !shouldSkipEmptyInput(node.type, incoming.length, inputItems, inputBranches)
    ) {
      continue;
    }

    emitSkipped(nodeId, nodeResults, outputs, onNodeResult);
  }
}

function toResult(
  r: FacadeNodeRunResult,
  durationMs: number,
  agentStream?: AiStreamChunk[],
): DebugNodeResult {
  const branches = r.outputItems ?? [[]];
  const itemCount = branches.reduce((sum: number, b: WorkflowItem[]) => sum + b.length, 0);
  return {
    status: r.status,
    outputItems: branches,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    itemCount,
    durationMs,
    logs: r.logs,
    agentStream: agentStream?.length ? agentStream : undefined,
  };
}

function recordDebugNodeResult(
  nodeId: string,
  debug: DebugNodeResult,
  nodeResults: Record<string, DebugNodeResult>,
  outputs: Map<string, WorkflowItem[][]>,
  onNodeResult?: (nodeId: string, result: DebugNodeResult) => void,
): void {
  nodeResults[nodeId] = debug;
  onNodeResult?.(nodeId, debug);
  if (debug.outputItems) {
    outputs.set(nodeId, debug.outputItems);
  }
}

export async function runDebugExecution(
  input: RunDebugExecutionInput,
): Promise<{
  status: 'success' | 'failed';
  failedNodeId?: string;
  nodeResults: Record<string, DebugNodeResult>;
}> {
  const { graph } = toWorkflowGraph(input.definition);
  const plan = planPartialExecution({
    graph: { nodes: graph.nodes, edges: graph.edges },
    targetNodeId: input.targetNodeId,
    pinData: input.pinData,
    pinBranchData: input.pinBranchData,
  });

  const loopRegions = collectLoopRegions(graph.nodes, graph.edges);
  const loopBodyExcluded = collectLoopBodyNodeIds(loopRegions);
  const executeOrder = plan.executeOrder.filter((id) => !loopBodyExcluded.has(id));

  const upstreamOrder = listUpstreamIdsInTopologicalOrder(
    graph.edges,
    input.targetNodeId,
  );
  const topologicalOrder = upstreamOrder.includes(input.targetNodeId)
    ? upstreamOrder
    : [...upstreamOrder, input.targetNodeId];

  const outputs = new Map<string, WorkflowItem[][]>();
  const nodeResults: Record<string, DebugNodeResult> = {};

  for (const [nodeId, branches] of plan.pinnedOutputBranches ?? []) {
    outputs.set(nodeId, branches);
    const itemCount = branches.reduce((sum, b) => sum + b.length, 0);
    const pinnedResult: DebugNodeResult = {
      status: 'success',
      outputItems: branches,
      itemCount,
    };
    nodeResults[nodeId] = pinnedResult;
    input.onNodeResult?.(nodeId, pinnedResult);
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const idToName = new Map(graph.nodes.map((n) => [n.id, n.name]));
  const executionId = input.executionId ?? `debug-${crypto.randomUUID()}`;

  const incomingByNode = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    if (!incomingByNode.has(edge.to)) incomingByNode.set(edge.to, []);
    incomingByNode.get(edge.to)!.push(edge);
  }

  const executeDebugNode = async (
    nodeId: string,
    scope: ScopedNodeInputScope & { orderIds: string[] },
  ): Promise<DebugNodeResult | 'skipped'> => {
    const node = nodeById.get(nodeId);
    if (!node) {
      const failed: DebugNodeResult = {
        status: 'failed',
        itemCount: 0,
        errorMessage: 'Node not found',
      };
      recordDebugNodeResult(nodeId, failed, nodeResults, scope.outputs, input.onNodeResult);
      return failed;
    }

    const mainIncoming = incomingByNode.get(nodeId) ?? [];
    const { inputItems, inputBranches, incomingEdgeCount } = resolveScopedNodeInput(
      nodeId,
      node,
      graph.edges,
      mainIncoming,
      scope,
    );

    if (
      shouldSkipScopedNodeInput(node.type, incomingEdgeCount, inputItems, inputBranches)
    ) {
      emitSkipped(nodeId, nodeResults, scope.outputs, input.onNodeResult);
      return 'skipped';
    }

    const upstreamOrderForNode = scope.orderIds.length
      ? scope.orderIds
      : listUpstreamIdsInTopologicalOrder(graph.edges, nodeId);
    const nodes = buildNodesContext(upstreamOrderForNode, nodeId, idToName, scope.outputs);

    const agentStream: AiStreamChunk[] = [];
    const startedAt = performance.now();
    input.onNodeStarted?.(nodeId);
    const runnerContext = resolveNodeRunRunnerContext({
      workflowDefinition: input.definition,
      workflowSettings: input.definition.settings ?? {},
      nodeRunId: nodeId,
      nodeType: normalizeNodeType(node.type),
    });

    let result: FacadeNodeRunResult;
    try {
      result = await input.executeNodeRun({
        executionId,
        nodeRunId: nodeId,
        nodeType: normalizeNodeType(node.type),
        nodeConfig: node.config,
        inputItems,
        inputBranches,
        workflowSettings: input.definition.settings ?? {},
        mode: 'partial',
        env: input.env,
        vars: input.vars,
        nodes,
        workflowDefinition: input.definition,
        errorPayload:
          normalizeNodeType(node.type) === 'errorTrigger'
            ? resolveErrorPayloadFromNodeConfig(node.config)
            : undefined,
        onAgentStream: shouldTrackAgentSteps(normalizeNodeType(node.type))
          ? (chunk) => {
              agentStream.push(chunk);
              input.onAgentStream?.(nodeId, chunk);
            }
          : undefined,
        onSatelliteStream: (satelliteNodeId, chunk) => {
          input.onAgentStream?.(satelliteNodeId, chunk);
          const trackHub = shouldTrackAgentSteps(normalizeNodeType(node.type));
          if (trackHub) {
            const mirrored = mirrorSatelliteStreamForHub(
              input.definition,
              satelliteNodeId,
              chunk,
            );
            if (mirrored) {
              agentStream.push(mirrored);
              input.onAgentStream?.(nodeId, mirrored);
            }
          }
        },
        locale: input.locale,
        effectivePolicy: runnerContext.effectivePolicy,
        runnerRequirements: runnerContext.runnerRequirements,
      });
    } catch (err) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const debug: DebugNodeResult = {
        status: 'failed',
        itemCount: 0,
        durationMs,
        errorCode: err instanceof AwfError ? err.code : undefined,
        errorMessage: formatErrorDetail(err),
        agentStream: agentStream.length ? agentStream : undefined,
      };
      recordDebugNodeResult(nodeId, debug, nodeResults, scope.outputs, input.onNodeResult);
      return debug;
    }

    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    const debug = toResult(result, durationMs, agentStream);
    debug.inputItems = inputItems;
    if (scope.loopRound != null && scope.totalLoopRounds != null && scope.loopIterationItems) {
      debug.loopIteration = {
        round: scope.loopRound,
        totalRounds: scope.totalLoopRounds,
        inputItems: inputItems.length ? inputItems : scope.loopIterationItems,
      };
    }
    recordDebugNodeResult(nodeId, debug, nodeResults, scope.outputs, input.onNodeResult);
    return debug;
  };

  for (const nodeId of executeOrder) {
    const node = nodeById.get(nodeId);
    if (!node) continue;

    if (node.type === 'loop') {
      const region = loopRegions.get(nodeId);
      const incoming = graph.edges.filter((e) => {
        if (e.to !== nodeId) return false;
        if (region?.bodyNodeIds.has(e.from)) return false;
        return true;
      });
      const { inputItems, inputBranches } = buildNodeInput(
        nodeId,
        node.type,
        incoming,
        outputs,
        input.triggerInputs,
      );

      if (shouldSkipEmptyInput(node.type, incoming.length, inputItems, inputBranches)) {
        const emptyLoop: DebugNodeResult = {
          status: 'success',
          itemCount: 0,
          outputItems: [[], []],
        };
        recordDebugNodeResult(nodeId, emptyLoop, nodeResults, outputs, input.onNodeResult);
        continue;
      }

      if (!region) {
        const failed: DebugNodeResult = {
          status: 'failed',
          itemCount: 0,
          errorMessage: 'Loop region not found',
        };
        recordDebugNodeResult(nodeId, failed, nodeResults, outputs, input.onNodeResult);
        return { status: 'failed', failedNodeId: nodeId, nodeResults };
      }

      const loopResult = await runLoopIterations({
        loopNodeId: nodeId,
        node,
        inputItems,
        region,
        edges: graph.edges,
        topologicalOrder,
        outputs,
        executeScopedNode: async (bodyNodeId, scope) => {
          const result = await executeDebugNode(bodyNodeId, scope);
          if (result === 'skipped') return { status: 'skipped' as const };
          if (result.status === 'failed') {
            return { status: 'failed' as const, outputItems: result.outputItems };
          }
          if (result.status === 'waiting') {
            return { status: 'waiting' as const, outputItems: result.outputItems };
          }
          return { status: 'success' as const, outputItems: result.outputItems };
        },
      });

      if (loopResult.status === 'failed') {
        const failed: DebugNodeResult = {
          status: 'failed',
          itemCount: 0,
          outputItems: loopResult.outputItems,
        };
        recordDebugNodeResult(nodeId, failed, nodeResults, outputs, input.onNodeResult);
        return {
          status: 'failed',
          failedNodeId: loopResult.failedNodeId ?? nodeId,
          nodeResults,
        };
      }
      if (loopResult.status === 'waiting') {
        const waiting: DebugNodeResult = {
          status: 'waiting',
          itemCount: loopResult.outputItems[1]?.length ?? 0,
          outputItems: loopResult.outputItems,
        };
        recordDebugNodeResult(nodeId, waiting, nodeResults, outputs, input.onNodeResult);
        return {
          status: 'failed',
          failedNodeId: loopResult.waitingNodeId,
          nodeResults,
        };
      }

      const itemCount = loopResult.outputItems[1]?.length ?? 0;
      const loopSuccess: DebugNodeResult = {
        status: 'success',
        itemCount,
        outputItems: loopResult.outputItems,
        loopIterationCount: loopResult.iterationCount,
        loopBatchItemCount: loopResult.batchItemCount,
      };
      recordDebugNodeResult(nodeId, loopSuccess, nodeResults, outputs, input.onNodeResult);
      continue;
    }

    const incoming = graph.edges.filter((e) => e.to === nodeId);
    const { inputItems, inputBranches } = buildNodeInput(
      nodeId,
      node.type,
      incoming,
      outputs,
      input.triggerInputs,
    );

    if (shouldSkipEmptyInput(node.type, incoming.length, inputItems, inputBranches)) {
      emitSkipped(nodeId, nodeResults, outputs, input.onNodeResult);
      continue;
    }

    const upstreamOrderIds = listUpstreamIdsInTopologicalOrder(graph.edges, nodeId);
    const result = await executeDebugNode(nodeId, {
      outputs,
      orderIds: upstreamOrderIds,
    });

    if (result !== 'skipped' && result.status === 'failed') {
      return { status: 'failed', failedNodeId: nodeId, nodeResults };
    }
  }

  const seedNodeIds = [
    ...executeOrder,
    ...Array.from(plan.pinnedOutputBranches.keys()),
  ];
  propagateSkippedDownstream(
    graph,
    seedNodeIds,
    outputs,
    nodeResults,
    input.onNodeResult,
  );

  return { status: 'success', nodeResults };
}
