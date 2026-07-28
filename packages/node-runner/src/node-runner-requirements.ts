import type { ResolveRunnerRequirements } from './dispatch/runner-dispatcher.js';

const BUILTIN_NODE_RUNNER_REQUIREMENTS: Record<string, ResolveRunnerRequirements> = {
  code: { capabilities: ['code'] },
  executeCommand: {
    capabilities: ['shell'],
    platforms: ['linux', 'windows', 'macos'],
  },
  httpRequest: { capabilities: ['http'] },
  readWriteFile: { capabilities: ['file'] },
  toolRead: { capabilities: ['file'] },
  toolWrite: { capabilities: ['file'] },
  toolGrep: { capabilities: ['file'] },
  toolShell: {
    capabilities: ['shell'],
    platforms: ['linux', 'windows', 'macos'],
  },
  toolWebSearch: { capabilities: ['web_search'] },
};

const registeredNodeRunnerRequirements = new Map<string, ResolveRunnerRequirements>();

/** Register requirements from a node plugin manifest (runnerRequirements). */
export function registerNodeRunnerRequirements(
  nodeType: string,
  requirements: ResolveRunnerRequirements,
): void {
  registeredNodeRunnerRequirements.set(nodeType, requirements);
}

export function clearRegisteredNodeRunnerRequirements(): void {
  registeredNodeRunnerRequirements.clear();
}

export function getNodeRunnerRequirements(
  nodeType: string,
): ResolveRunnerRequirements | undefined {
  return (
    registeredNodeRunnerRequirements.get(nodeType) ??
    BUILTIN_NODE_RUNNER_REQUIREMENTS[nodeType]
  );
}
