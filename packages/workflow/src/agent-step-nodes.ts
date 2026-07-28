/** Node types that emit onAgentStream steps persisted on node run metadata. */
const AGENT_STEP_TRACKED_NODE_TYPES = new Set([
  'aiAgent',
  'skillRun',
  'crewSequential',
  'crewHierarchical',
  'crewSupervisor',
  'groupChat',
]);

export function shouldTrackAgentSteps(nodeType: string): boolean {
  return AGENT_STEP_TRACKED_NODE_TYPES.has(nodeType);
}
