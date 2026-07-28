import type { WorkflowItem } from '@rxwf/shared';
import { shouldSkipEmptyInput } from './should-skip-empty-input.js';
import type { LoopRegion } from './loop-region.js';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './execution-engine.js';

export function chunkItems(items: WorkflowItem[], batchSize: number): WorkflowItem[][] {
  const size = Math.max(1, batchSize);
  if (items.length === 0) return [];
  const batches: WorkflowItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

export function bodyTopologicalOrder(
  bodyNodeIds: Set<string>,
  edges: WorkflowGraphEdge[],
): string[] {
  const ids = [...bodyNodeIds];
  const visited = new Set<string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id) || !bodyNodeIds.has(id)) return;
    visited.add(id);
    for (const edge of edges) {
      if (edge.to === id && bodyNodeIds.has(edge.from)) visit(edge.from);
    }
    order.push(id);
  };
  for (const id of ids) visit(id);
  return order;
}

export interface ScopedNodeInputScope {
  outputs: Map<string, WorkflowItem[][]>;
  loopIterationItems?: WorkflowItem[];
  loopNodeId?: string;
  region?: LoopRegion;
  /** 1-based round index within the current Loop execution. */
  loopRound?: number;
  totalLoopRounds?: number;
}

export function resolveScopedNodeInput(
  nodeId: string,
  node: WorkflowGraphNode,
  edges: WorkflowGraphEdge[],
  mainIncoming: WorkflowGraphEdge[],
  scope: ScopedNodeInputScope,
  options?: {
    startNodeId?: string;
    initialItems?: WorkflowItem[];
  },
): {
  inputItems: WorkflowItem[];
  inputBranches: WorkflowItem[][] | undefined;
  incomingEdgeCount: number;
} {
  const bodyIncoming = scope.region
    ? edges.filter(
        (e) =>
          e.to === nodeId &&
          (scope.region!.bodyNodeIds.has(e.from) || e.from === scope.loopNodeId),
      )
    : mainIncoming;

  let inputItems: WorkflowItem[] =
    scope.loopIterationItems && scope.region?.bodyEntryIds.includes(nodeId)
      ? scope.loopIterationItems
      : nodeId === options?.startNodeId && !scope.region
        ? (options.initialItems ?? [])
        : [];

  let inputBranches: WorkflowItem[][] | undefined;
  const incoming = scope.region ? bodyIncoming : mainIncoming;

  if (incoming.length > 0) {
    const branches: WorkflowItem[][] = [];
    for (const edge of incoming) {
      if (edge.from === scope.loopNodeId && scope.loopIterationItems) {
        branches.push(scope.loopIterationItems);
        continue;
      }
      const predOutputs = scope.outputs.get(edge.from);
      const idx = edge.outputIndex ?? 0;
      branches.push(predOutputs?.[idx] ?? []);
    }
    if (node.type === 'merge') {
      inputBranches = branches;
      inputItems = [];
    } else {
      inputItems = branches.flat();
    }
  } else if (nodeId !== options?.startNodeId && !scope.region) {
    inputItems = [];
  }

  return {
    inputItems,
    inputBranches,
    incomingEdgeCount: incoming.length,
  };
}

export function shouldSkipScopedNodeInput(
  nodeType: string,
  incomingEdgeCount: number,
  inputItems: WorkflowItem[],
  inputBranches?: WorkflowItem[][],
): boolean {
  return shouldSkipEmptyInput(nodeType, incomingEdgeCount, inputItems, inputBranches);
}

export type ExecuteScopedNodeFn = (
  nodeId: string,
  scope: ScopedNodeInputScope & { orderIds: string[] },
) => Promise<{ status: 'success' | 'failed' | 'waiting' | 'skipped'; outputItems?: WorkflowItem[][] }>;

export interface RunLoopIterationsInput {
  loopNodeId: string;
  node: WorkflowGraphNode;
  inputItems: WorkflowItem[];
  region: LoopRegion;
  edges: WorkflowGraphEdge[];
  topologicalOrder: string[];
  outputs: Map<string, WorkflowItem[][]>;
  executeScopedNode: ExecuteScopedNodeFn;
}

export interface RunLoopIterationsResult {
  status: 'success' | 'failed' | 'waiting';
  failedNodeId?: string;
  waitingNodeId?: string;
  outputItems: WorkflowItem[][];
  iterationCount?: number;
  batchItemCount?: number;
}

export async function runLoopIterations(
  input: RunLoopIterationsInput,
): Promise<RunLoopIterationsResult> {
  const { region } = input;
  if (region.bodyNodeIds.size === 0) {
    return {
      status: 'failed',
      failedNodeId: input.loopNodeId,
      outputItems: [[], []],
    };
  }

  const batchSize = Number(input.node.config.batchSize ?? 1);
  const batches = chunkItems(input.inputItems, batchSize);
  const frozenPrefix = input.topologicalOrder.filter(
    (id) => id !== input.loopNodeId && !region.bodyNodeIds.has(id),
  );
  const bodyOrder = bodyTopologicalOrder(region.bodyNodeIds, input.edges);
  const aggregatedDone: WorkflowItem[] = [];

  for (let roundIndex = 0; roundIndex < batches.length; roundIndex++) {
    const batch = batches[roundIndex]!;
    const iterationOutputs = new Map<string, WorkflowItem[][]>();
    for (const [k, v] of input.outputs) {
      if (!region.bodyNodeIds.has(k)) iterationOutputs.set(k, v);
    }

    for (const bodyNodeId of bodyOrder) {
      const result = await input.executeScopedNode(bodyNodeId, {
        outputs: iterationOutputs,
        orderIds: [...frozenPrefix, ...bodyOrder.slice(0, bodyOrder.indexOf(bodyNodeId) + 1)],
        loopIterationItems: batch,
        loopNodeId: input.loopNodeId,
        region,
        loopRound: roundIndex + 1,
        totalLoopRounds: batches.length,
      });

      if (result.status === 'skipped') continue;
      if (result.status === 'failed') {
        return {
          status: 'failed',
          failedNodeId: bodyNodeId,
          outputItems: [[], []],
        };
      }
      if (result.status === 'waiting') {
        return {
          status: 'waiting',
          waitingNodeId: bodyNodeId,
          outputItems: [[], []],
        };
      }
      iterationOutputs.set(bodyNodeId, result.outputItems ?? [[]]);
    }

    for (const exitId of region.bodyExitIds) {
      const branch = iterationOutputs.get(exitId)?.[0] ?? [];
      aggregatedDone.push(...branch);
    }
    if (region.bodyExitIds.length === 0 && bodyOrder.length > 0) {
      const lastId = bodyOrder[bodyOrder.length - 1]!;
      aggregatedDone.push(...(iterationOutputs.get(lastId)?.[0] ?? []));
    }
  }

  return {
    status: 'success',
    outputItems: [[], aggregatedDone],
    iterationCount: batches.length,
    batchItemCount: batches[0]?.length ?? 0,
  };
}

export function collectLoopBodyNodeIds(
  loopRegions: Map<string, LoopRegion>,
): Set<string> {
  const excluded = new Set<string>();
  for (const region of loopRegions.values()) {
    for (const id of region.bodyNodeIds) excluded.add(id);
  }
  return excluded;
}
