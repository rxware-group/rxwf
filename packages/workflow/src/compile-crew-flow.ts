import type { AwfCrewFlowGraphIr, AwfCrewMemberIr } from './crew-ir.js';

export interface CompileCrewFlowRouterInput {
  afterMemberNodeId: string;
  branches: Array<{ condition: string; memberNodeId: string; label?: string }>;
  defaultMemberNodeId: string;
}

function taskIdForMember(memberNodeId: string): string {
  return `flow_task_${memberNodeId}`;
}

/** Build start → task* → end; optionally insert a conditional router after one member. */
export function compileCrewFlowGraph(
  members: AwfCrewMemberIr[],
  router?: CompileCrewFlowRouterInput,
): AwfCrewFlowGraphIr {
  const startId = 'flow_start';
  const endId = 'flow_end';

  if (!router) {
    const taskNodes = members.map((member) => ({
      id: taskIdForMember(member.nodeId),
      type: 'task' as const,
      memberNodeId: member.nodeId,
    }));
    const nodes = [{ id: startId, type: 'start' as const }, ...taskNodes, { id: endId, type: 'end' as const }];
    const edges: AwfCrewFlowGraphIr['edges'] = [];
    let prev = startId;
    for (const task of taskNodes) {
      edges.push({ from: prev, to: task.id });
      prev = task.id;
    }
    edges.push({ from: prev, to: endId });
    return { entryNodeId: startId, nodes, edges };
  }

  const afterIndex = members.findIndex((m) => m.nodeId === router.afterMemberNodeId);
  if (afterIndex < 0) {
    throw new Error('E1047: flowRouter.afterMemberNodeId not found in crew members');
  }

  const prefixMembers = members.slice(0, afterIndex + 1);
  const routerId = 'flow_router_1';
  const nodes: AwfCrewFlowGraphIr['nodes'] = [{ id: startId, type: 'start' }];
  const edges: AwfCrewFlowGraphIr['edges'] = [];
  let prev = startId;

  for (const member of prefixMembers) {
    const id = taskIdForMember(member.nodeId);
    nodes.push({ id, type: 'task', memberNodeId: member.nodeId });
    edges.push({ from: prev, to: id });
    prev = id;
  }

  const branchTargets = new Set<string>();
  const branches = router.branches.map((b, index) => {
    const next = taskIdForMember(b.memberNodeId);
    branchTargets.add(b.memberNodeId);
    return {
      label: b.label ?? `branch_${index + 1}`,
      next,
      condition: b.condition,
    };
  });

  const defaultNext = taskIdForMember(router.defaultMemberNodeId);
  branchTargets.add(router.defaultMemberNodeId);

  nodes.push({
    id: routerId,
    type: 'router',
    router: { defaultNext, branches },
  });
  edges.push({ from: prev, to: routerId });

  for (const memberNodeId of branchTargets) {
    const member = members.find((m) => m.nodeId === memberNodeId);
    if (!member) continue;
    const id = taskIdForMember(member.nodeId);
    if (!nodes.some((n) => n.id === id)) {
      nodes.push({ id, type: 'task', memberNodeId: member.nodeId });
    }
    edges.push({ from: id, to: endId });
  }

  nodes.push({ id: endId, type: 'end' });
  return { entryNodeId: startId, nodes, edges };
}
