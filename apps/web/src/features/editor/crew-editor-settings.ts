import type { WorkflowDefinition } from '../../api/client.js';

/** Orchestration nodes hidden from the palette when Crew is disabled. */
export const CREW_ORCHESTRATION_NODE_TYPES = new Set([
  'crewSequential',
  'crewHierarchical',
  'crewSupervisor',
  'groupChat',
]);

export const CREW_RESOURCE_PORT_IDS = new Set([
  'crew_member',
  'crew_manager',
  'group_member',
  'group_orchestrator',
]);

/** aiAgent parameters shown only when Crew orchestration is enabled. */
export const AI_AGENT_CREW_PARAM_KEYS = new Set([
  'role',
  'goal',
  'backstory',
  'taskDescription',
  'expectedOutput',
]);

export interface NodePortsEditorOptions {
  enableCrew?: boolean;
}

export function isCrewEditorEnabled(
  settings?: WorkflowDefinition['settings'],
): boolean {
  if (settings?.enableCrew === false) return false;
  if (settings?.enableCrew === true) return true;
  if (settings?.workflowKind === 'automation') return false;
  return true;
}

export function getNodePortsEditorOptions(
  settings?: WorkflowDefinition['settings'],
): NodePortsEditorOptions {
  return { enableCrew: isCrewEditorEnabled(settings) };
}

export function isCrewResourcePortId(portId: string): boolean {
  return CREW_RESOURCE_PORT_IDS.has(portId);
}

export function isCrewPaletteNodeType(type: string, enableCrew: boolean): boolean {
  if (enableCrew) return true;
  return !CREW_ORCHESTRATION_NODE_TYPES.has(type);
}
