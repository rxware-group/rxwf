import type { NodeOutputEntry } from '@rxwf/expression';
import type { ResolveRunnerRequirements } from '@rxwf/node-runner';
import type { SandboxLogEntry } from '@rxwf/sandbox';
import type { WorkflowItem } from '@rxwf/shared';
import type { WorkflowDefinition, RunnerPolicy } from '@rxwf/workflow';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import { buildNodesContext } from './named-node-context.js';
import { shouldSkipEmptyInput } from './should-skip-empty-input.js';
import { resolveNodeRunRunnerContext } from '../runner/resolve-node-run-runner.js';
import type { ErrorWorkflowPayload } from '../error-workflow/error-payload.js';
import { resolveErrorPayloadFromNodeConfig } from '../error-workflow/error-payload.js';
import { collectLoopRegions, type LoopRegion } from './loop-region.js';
import {
  collectLoopBodyNodeIds,
  runLoopIterations,
  resolveScopedNodeInput,
  shouldSkipScopedNodeInput,
} from './loop-execution.js';
import { passThroughBinaryOnOutput } from './binary-pass-through.js';

export interface NodeRunJob {
  executionId: string;
  nodeRunId: string;
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputItems: WorkflowItem[];
  workflowSettings: Record<string, unknown>;
  mode: 'production' | 'manual' | 'partial';
  executionEnvironment?: 'test' | 'prod';
  executionStartedAt?: string;
  workflowVersionId?: string;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  /** Preceding nodes' outputs ($nodes) */
  nodes?: NodeOutputEntry[];
  inputBranches?: WorkflowItem[][];
  parentExecutionId?: string;
  subworkflowDepth?: number;
  workflowDefinition?: WorkflowDefinition;
  workflowId?: string;
  sessionId?: string;
  onAgentStream?: (chunk: AiStreamChunk) => void;
  onSatelliteStream?: (
    satelliteNodeId: string,
    chunk: AiStreamChunk,
  ) => void;
  effectivePolicy?: RunnerPolicy;
  runnerRequirements?: ResolveRunnerRequirements;
  errorPayload?: ErrorWorkflowPayload;
  locale?: string;
}

export interface FacadeNodeRunResult {
  status: 'success' | 'failed' | 'skipped' | 'waiting';
  outputItems?: WorkflowItem[][];
  errorCode?: string;
  errorMessage?: string;
  logs?: SandboxLogEntry[];
  runnerId: string;
  runnerPlatform: { os: string; arch: string };
}

export interface WorkflowGraphNode {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface WorkflowGraphEdge {
  from: string;
  to: string;
  outputIndex?: number;
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  startNodeId: string;
}

export interface ExecutionEngineDeps {
  executeNodeRun(job: NodeRunJob): Promise<FacadeNodeRunResult>;
}

export interface RunExecutionInput {
  executionId: string;
  graph: WorkflowGraph;
  startNodeId: string;
  initialItems: WorkflowItem[];
  mode: NodeRunJob['mode'];
  executionEnvironment?: 'test' | 'prod';
  executionStartedAt?: string;
  workflowVersionId?: string;
  workflowSettings?: Record<string, unknown>;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  parentExecutionId?: string;
  subworkflowDepth?: number;
  workflowDefinition?: WorkflowDefinition;
  workflowId?: string;
  sessionId?: string;
  onAgentStream?: (chunk: AiStreamChunk) => void;
  onSatelliteStream?: (
    satelliteNodeId: string,
    chunk: AiStreamChunk,
  ) => void;
  orchestrationResume?: {
    kind: 'groupChat';
    checkpoint: Record<string, unknown>;
    userMessage: string;
  };
  /** Skip execution for nodes with precomputed outputs (HITL resume). */
  precomputedOutputs?: Map<string, WorkflowItem[][]>;
  /** Error trigger: failure context from enqueue or debug */
  errorPayload?: ErrorWorkflowPayload;
  locale?: string;
}

export interface RunExecutionResult {
  status: 'success' | 'failed' | 'waiting';
  failedNodeId?: string;
  waitingNodeId?: string;
  finalOutputItems?: WorkflowItem[];
}

function reachableFrom(startId: string, edges: WorkflowGraphEdge[]): Set<string> {
  const reachable = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges.filter((e) => e.from === current)) {
      if (!reachable.has(edge.to)) {
        reachable.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return reachable;
}

function topologicalOrder(
  startId: string,
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[],
): string[] {
  const reachable = reachableFrom(startId, edges);
  const nodeIds = nodes.map((n) => n.id).filter((id) => reachable.has(id));
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const pred of edges.filter((e) => e.to === id).map((e) => e.from)) {
      if (reachable.has(pred)) visit(pred);
    }
    order.push(id);
  };

  visit(startId);
  for (const id of nodeIds) {
    if (!visited.has(id)) visit(id);
  }
  return order;
}

export function createExecutionEngine(deps: ExecutionEngineDeps) {
  return {
    async run(input: RunExecutionInput): Promise<RunExecutionResult> {
      const executionStartedAt =
        input.executionStartedAt ?? new Date().toISOString();
      const executionEnvironment =
        input.executionEnvironment ??
        (input.mode === 'production' ? 'prod' : 'test');
      const nodeById = new Map(input.graph.nodes.map((n) => [n.id, n]));
      const idToName = new Map(input.graph.nodes.map((n) => [n.id, n.name]));
      const outputs = new Map<string, WorkflowItem[][]>();
      const order = topologicalOrder(input.startNodeId, input.graph.nodes, input.graph.edges);
      const reachable = new Set(order);
      const loopRegions = collectLoopRegions(input.graph.nodes, input.graph.edges);
      const loopBodyExcluded = collectLoopBodyNodeIds(loopRegions);
      const mainOrder = order.filter((id) => !loopBodyExcluded.has(id));

      const incomingByNode = new Map<string, WorkflowGraphEdge[]>();
      const adjacency = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      for (const id of mainOrder) {
        incomingByNode.set(id, []);
        adjacency.set(id, []);
        inDegree.set(id, 0);
      }
      for (const edge of input.graph.edges) {
        if (!reachable.has(edge.from) || !reachable.has(edge.to)) continue;
        if (loopBodyExcluded.has(edge.from) || loopBodyExcluded.has(edge.to)) continue;
        incomingByNode.get(edge.to)!.push(edge);
        adjacency.get(edge.from)!.push(edge.to);
        inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      }

      const readyQueue: string[] = [];
      for (const id of mainOrder) {
        if ((inDegree.get(id) ?? 0) === 0) readyQueue.push(id);
      }
      if (readyQueue.length === 0 && mainOrder.length > 0) {
        readyQueue.push(mainOrder[0]!);
      }

      let running = 0;
      let finished = 0;
      let resolved = false;
      let hasFailed = false;
      let hasWaiting = false;
      let waitingNodeId: string | undefined;

      return await new Promise<RunExecutionResult>((resolve) => {
        const maybeResolveSuccess = () => {
          if (resolved || hasFailed || hasWaiting) return;
          if (running !== 0) return;
          if (finished < mainOrder.length) return;
          resolved = true;
          const lastNodeId = mainOrder[mainOrder.length - 1];
          const lastOutputs = lastNodeId ? outputs.get(lastNodeId)?.[0] : undefined;
          resolve({ status: 'success', finalOutputItems: lastOutputs });
        };

        const scheduleReady = () => {
          while (!hasFailed && !hasWaiting && readyQueue.length > 0) {
            const nodeId = readyQueue.shift()!;
            running++;
            void runNode(nodeId).finally(() => {
              running--;
              finished++;
              maybeResolveSuccess();
              if (!hasFailed && !hasWaiting) scheduleReady();
            });
          }
          maybeResolveSuccess();
        };

        const executeOneNode = async (
          nodeId: string,
          scope: {
            outputs: Map<string, WorkflowItem[][]>;
            orderIds: string[];
            loopIterationItems?: WorkflowItem[];
            loopNodeId?: string;
            region?: LoopRegion;
          },
        ): Promise<FacadeNodeRunResult | 'skipped'> => {
          const node = nodeById.get(nodeId);
          if (!node) {
            return {
              status: 'failed',
              errorCode: 'E2000',
              errorMessage: 'Node not found',
              runnerId: '',
              runnerPlatform: { os: 'linux', arch: 'x64' },
            };
          }

          const mainIncoming = incomingByNode.get(nodeId) ?? [];
          const { inputItems, inputBranches, incomingEdgeCount } = resolveScopedNodeInput(
            nodeId,
            node,
            input.graph.edges,
            mainIncoming,
            scope,
            {
              startNodeId: input.startNodeId,
              initialItems: input.initialItems,
            },
          );

          const nodes = buildNodesContext(scope.orderIds, nodeId, idToName, scope.outputs);

          if (
            shouldSkipScopedNodeInput(
              node.type,
              incomingEdgeCount,
              inputItems,
              inputBranches,
            )
          ) {
            scope.outputs.set(nodeId, [[]]);
            return 'skipped';
          }

          const runnerContext = resolveNodeRunRunnerContext({
            workflowDefinition: input.workflowDefinition,
            workflowSettings: input.workflowSettings,
            nodeRunId: nodeId,
            nodeType: node.type,
          });

          return deps.executeNodeRun({
            executionId: input.executionId,
            nodeRunId: nodeId,
            nodeType: node.type,
            nodeConfig: node.config,
            inputItems,
            inputBranches,
            workflowSettings: input.workflowSettings ?? {},
            mode: input.mode,
            executionEnvironment,
            executionStartedAt,
            workflowVersionId: input.workflowVersionId,
            env: input.env,
            vars: input.vars,
            nodes,
            parentExecutionId: input.parentExecutionId,
            subworkflowDepth: input.subworkflowDepth,
            workflowDefinition: input.workflowDefinition,
            workflowId: input.workflowId,
            sessionId: input.sessionId,
            onAgentStream: input.onAgentStream,
            onSatelliteStream: input.onSatelliteStream,
            effectivePolicy: runnerContext.effectivePolicy,
            runnerRequirements: runnerContext.runnerRequirements,
            locale: input.locale,
            errorPayload:
              node.type === 'errorTrigger'
                ? (input.errorPayload ?? resolveErrorPayloadFromNodeConfig(node.config))
                : undefined,
          });
        };

        const runLoopNode = async (
          nodeId: string,
          node: WorkflowGraphNode,
          inputItems: WorkflowItem[],
        ): Promise<void> => {
          const region = loopRegions.get(nodeId);
          if (!region) {
            if (!resolved) {
              resolved = true;
              hasFailed = true;
              resolve({
                status: 'failed',
                failedNodeId: nodeId,
              });
            }
            return;
          }

          const loopResult = await runLoopIterations({
            loopNodeId: nodeId,
            node,
            inputItems,
            region,
            edges: input.graph.edges,
            topologicalOrder: order,
            outputs,
            executeScopedNode: async (bodyNodeId, scope) => {
              if (hasFailed || hasWaiting) {
                return { status: 'failed' as const };
              }
              const result = await executeOneNode(bodyNodeId, scope);
              if (result === 'skipped') return { status: 'skipped' as const };
              return result;
            },
          });

          if (loopResult.status === 'failed') {
            if (!resolved) {
              resolved = true;
              hasFailed = true;
              resolve({
                status: 'failed',
                failedNodeId: loopResult.failedNodeId ?? nodeId,
              });
            }
            return;
          }
          if (loopResult.status === 'waiting') {
            if (!resolved) {
              resolved = true;
              hasWaiting = true;
              waitingNodeId = loopResult.waitingNodeId;
              resolve({
                status: 'waiting',
                waitingNodeId: loopResult.waitingNodeId,
              });
            }
            return;
          }

          outputs.set(nodeId, loopResult.outputItems);
        };

        const runNode = async (nodeId: string): Promise<void> => {
          const node = nodeById.get(nodeId);
          if (!node || hasFailed || hasWaiting) return;

          const precomputed = input.precomputedOutputs?.get(nodeId);
          if (precomputed) {
            outputs.set(nodeId, precomputed);
            for (const nextId of adjacency.get(nodeId) ?? []) {
              const next = (inDegree.get(nextId) ?? 1) - 1;
              inDegree.set(nextId, next);
              if (next === 0) readyQueue.push(nextId);
            }
            return;
          }
          const incoming = incomingByNode.get(nodeId) ?? [];
          let inputItems: WorkflowItem[] = input.initialItems;
          let inputBranches: WorkflowItem[][] | undefined;

          if (incoming.length > 0) {
            const branches: WorkflowItem[][] = [];
            for (const edge of incoming) {
              const predOutputs = outputs.get(edge.from);
              const idx = edge.outputIndex ?? 0;
              branches.push(predOutputs?.[idx] ?? []);
            }
            if (node.type === 'merge') {
              inputBranches = branches;
              inputItems = [];
            } else {
              inputItems = branches.flat();
            }
          } else if (nodeId !== input.startNodeId) {
            inputItems = [];
          }

          if (node.type === 'loop') {
            if (
              shouldSkipEmptyInput(node.type, incoming.length, inputItems, inputBranches)
            ) {
              outputs.set(nodeId, [[], []]);
            } else {
              await runLoopNode(nodeId, node, inputItems);
            }
            if (hasFailed || hasWaiting) return;
            for (const nextId of adjacency.get(nodeId) ?? []) {
              const next = (inDegree.get(nextId) ?? 1) - 1;
              inDegree.set(nextId, next);
              if (next === 0) readyQueue.push(nextId);
            }
            return;
          }

          let result: Awaited<ReturnType<typeof executeOneNode>>;
          try {
            result = await executeOneNode(nodeId, {
              outputs,
              orderIds: order,
            });
          } catch (err) {
            if (!resolved) {
              resolved = true;
              hasFailed = true;
              resolve({
                status: 'failed',
                failedNodeId: nodeId,
              });
            }
            return;
          }

          if (result === 'skipped') {
            for (const nextId of adjacency.get(nodeId) ?? []) {
              const next = (inDegree.get(nextId) ?? 1) - 1;
              inDegree.set(nextId, next);
              if (next === 0) readyQueue.push(nextId);
            }
            return;
          }

          if (result.status === 'failed') {
            if (!resolved) {
              resolved = true;
              hasFailed = true;
              resolve({ status: 'failed', failedNodeId: nodeId });
            }
            return;
          }

          if (result.status === 'waiting') {
            if (!resolved) {
              resolved = true;
              hasWaiting = true;
              waitingNodeId = nodeId;
              resolve({ status: 'waiting', waitingNodeId: nodeId });
            }
            return;
          }

          outputs.set(
            nodeId,
            passThroughBinaryOnOutput(inputItems, result.outputItems ?? [[]]),
          );
          for (const nextId of adjacency.get(nodeId) ?? []) {
            const next = (inDegree.get(nextId) ?? 1) - 1;
            inDegree.set(nextId, next);
            if (next === 0) readyQueue.push(nextId);
          }
        };

        scheduleReady();
      });
    },
  };
}
