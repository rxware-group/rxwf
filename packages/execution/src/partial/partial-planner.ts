import type { WorkflowItem } from '@rxwf/shared';

export interface GraphNode {
  id: string;
  type: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface PartialPlanInput {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  targetNodeId: string;
  pinData?: Record<string, WorkflowItem[]>;
  pinBranchData?: Record<string, WorkflowItem[][]>;
}

export interface PartialPlan {
  executeOrder: string[];
  pinnedOutputBranches: Map<string, WorkflowItem[][]>;
}

/** 目标节点的全部上游 id，拓扑序（不含目标自身）。 */
export function listUpstreamIdsInTopologicalOrder(
  edges: GraphEdge[],
  targetNodeId: string,
): string[] {
  const upstream = new Set<string>();
  const visitUp = (nodeId: string) => {
    for (const edge of edges) {
      if (edge.to === nodeId && !upstream.has(edge.from)) {
        upstream.add(edge.from);
        visitUp(edge.from);
      }
    }
  };
  visitUp(targetNodeId);

  const order: string[] = [];
  const visited = new Set<string>();
  const dfs = (id: string) => {
    if (visited.has(id) || !upstream.has(id)) return;
    visited.add(id);
    for (const edge of edges) {
      if (edge.to === id && upstream.has(edge.from)) dfs(edge.from);
    }
    order.push(id);
  };
  for (const id of upstream) {
    if (!visited.has(id)) dfs(id);
  }
  return order;
}

function hasPinnedOutput(
  pinData: Record<string, WorkflowItem[]>,
  pinBranchData: Record<string, WorkflowItem[][]>,
  nodeId: string,
): boolean {
  if (pinBranchData[nodeId] !== undefined) return true;
  return (pinData[nodeId]?.length ?? 0) > 0;
}

export function planPartialExecution(input: PartialPlanInput): PartialPlan {
  const upstreamOrder = listUpstreamIdsInTopologicalOrder(
    input.graph.edges,
    input.targetNodeId,
  );
  const pinData = input.pinData ?? {};
  const pinBranchData = input.pinBranchData ?? {};

  const neededMemo = new Map<string, boolean>();
  const visiting = new Set<string>();

  const isNeeded = (nodeId: string): boolean => {
    const cached = neededMemo.get(nodeId);
    if (cached !== undefined) return cached;

    // Loop body → Loop main 回连会形成图环；沿下游递归时需截断，避免栈溢出。
    if (visiting.has(nodeId)) return false;

    visiting.add(nodeId);

    let needed: boolean;
    if (nodeId === input.targetNodeId) {
      needed = true;
    } else if (hasPinnedOutput(pinData, pinBranchData, nodeId)) {
      needed = false;
    } else {
      const children = input.graph.edges
        .filter((e) => e.from === nodeId)
        .map((e) => e.to);
      needed = children.some((child) => isNeeded(child));
    }

    visiting.delete(nodeId);
    neededMemo.set(nodeId, needed);
    return needed;
  };

  const pinnedOutputBranches = new Map<string, WorkflowItem[][]>();
  const executeOrder: string[] = [];

  for (const nodeId of upstreamOrder) {
    if (hasPinnedOutput(pinData, pinBranchData, nodeId)) {
      const branches =
        pinBranchData[nodeId] ?? (pinData[nodeId] ? [pinData[nodeId]!] : [[]]);
      pinnedOutputBranches.set(nodeId, branches);
      continue;
    }
    if (isNeeded(nodeId)) {
      executeOrder.push(nodeId);
    }
  }
  if (isNeeded(input.targetNodeId)) {
    executeOrder.push(input.targetNodeId);
  }

  return { executeOrder, pinnedOutputBranches };
}
