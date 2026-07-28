import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export const GROUP_MEMBER_INPUT = 'group_member';
export const GROUP_MEMBER_OUTPUT = 'group_member';
export const GROUP_ORCHESTRATOR_INPUT = 'group_orchestrator';
export const GROUP_ORCHESTRATOR_OUTPUT = 'group_orchestrator';

export function isGroupChatOrchestrationConnection(
  connection: WorkflowDefinition['connections'][number],
): boolean {
  const toInput = connection.toInput ?? 'main';
  const fromOutput = connection.fromOutput ?? 'main';
  return (
    toInput === GROUP_MEMBER_INPUT ||
    fromOutput === GROUP_MEMBER_OUTPUT ||
    toInput === GROUP_ORCHESTRATOR_INPUT ||
    fromOutput === GROUP_ORCHESTRATOR_OUTPUT
  );
}

export function collectGroupMembers(
  definition: WorkflowDefinition,
  groupChatNodeId: string,
): WorkflowNode[] {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const members: WorkflowNode[] = [];
  for (const c of definition.connections) {
    if (c.to !== groupChatNodeId) continue;
    if ((c.toInput ?? 'main') !== GROUP_MEMBER_INPUT) continue;
    const from = byId.get(c.from);
    if (!from || from.type !== 'aiAgent') continue;
    members.push(from);
  }
  members.sort((a, b) => {
    const dx = (a.position?.x ?? 0) - (b.position?.x ?? 0);
    if (dx !== 0) return dx;
    return (a.position?.y ?? 0) - (b.position?.y ?? 0);
  });
  return members;
}

export function collectGroupOrchestrator(
  definition: WorkflowDefinition,
  groupChatNodeId: string,
): WorkflowNode | null {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  for (const c of definition.connections) {
    if (c.to !== groupChatNodeId) continue;
    if ((c.toInput ?? 'main') !== GROUP_ORCHESTRATOR_INPUT) continue;
    const from = byId.get(c.from);
    if (from?.type === 'aiAgent') return from;
  }
  return null;
}
