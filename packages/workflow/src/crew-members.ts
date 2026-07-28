import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export const CREW_MEMBER_INPUT = 'crew_member';
export const CREW_MEMBER_OUTPUT = 'crew_member';
export const CREW_MANAGER_INPUT = 'crew_manager';
export const CREW_MANAGER_OUTPUT = 'crew_manager';

export function isCrewMemberConnection(
  connection: WorkflowDefinition['connections'][number],
): boolean {
  const toInput = connection.toInput ?? 'main';
  const fromOutput = connection.fromOutput ?? 'main';
  return toInput === CREW_MEMBER_INPUT || fromOutput === CREW_MEMBER_OUTPUT;
}

export function isCrewManagerConnection(
  connection: WorkflowDefinition['connections'][number],
): boolean {
  const toInput = connection.toInput ?? 'main';
  const fromOutput = connection.fromOutput ?? 'main';
  return toInput === CREW_MANAGER_INPUT || fromOutput === CREW_MANAGER_OUTPUT;
}

export function isCrewOrchestrationConnection(
  connection: WorkflowDefinition['connections'][number],
): boolean {
  return isCrewMemberConnection(connection) || isCrewManagerConnection(connection);
}

export function collectCrewManager(
  definition: WorkflowDefinition,
  crewNodeId: string,
): WorkflowNode | null {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  for (const c of definition.connections) {
    if (c.to !== crewNodeId) continue;
    if ((c.toInput ?? 'main') !== CREW_MANAGER_INPUT) continue;
    const from = byId.get(c.from);
    if (from?.type === 'aiAgent') return from;
  }
  return null;
}

export function collectCrewWorkers(
  definition: WorkflowDefinition,
  crewNodeId: string,
  options?: { excludeNodeId?: string },
): WorkflowNode[] {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  const members: WorkflowNode[] = [];
  for (const c of definition.connections) {
    if (c.to !== crewNodeId) continue;
    if ((c.toInput ?? 'main') !== CREW_MEMBER_INPUT) continue;
    const from = byId.get(c.from);
    if (!from || from.type !== 'aiAgent') continue;
    if (options?.excludeNodeId && from.id === options.excludeNodeId) continue;
    members.push(from);
  }
  members.sort((a, b) => {
    const dx = (a.position?.x ?? 0) - (b.position?.x ?? 0);
    if (dx !== 0) return dx;
    return (a.position?.y ?? 0) - (b.position?.y ?? 0);
  });
  return members;
}

/** @deprecated Use collectCrewWorkers */
export function collectCrewMembers(
  definition: WorkflowDefinition,
  crewNodeId: string,
): WorkflowNode[] {
  return collectCrewWorkers(definition, crewNodeId);
}
