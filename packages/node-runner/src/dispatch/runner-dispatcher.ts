import type {
  RunnerGatewayPort,
  RunnerRecord,
  RunnerRepositoryPort,
} from '@rxwf/providers-contracts';
import { E2010 } from '@rxwf/runner-protocol';
import { AwfError } from '@rxwf/shared';
import type { RunnerOs, RunnerPolicy } from '@rxwf/workflow';

export interface ResolveRunnerRequirements {
  platforms?: string[];
  capabilities?: string[];
}

export interface ResolveRunnerInput {
  effectivePolicy: RunnerPolicy;
  requirements?: ResolveRunnerRequirements;
}

export type ResolvedRunner = RunnerRecord;

function isStringSuperset(haystack: string[] | undefined, required: string[] | undefined): boolean {
  if (!required?.length) return true;
  const set = new Set(haystack ?? []);
  return required.every((item) => set.has(item));
}

function matchesPolicyPlatform(runner: RunnerRecord, platform?: RunnerOs): boolean {
  if (!platform) return true;
  return runner.platform.os === platform;
}

function isAgentCandidate(
  runner: RunnerRecord,
  gateway: RunnerGatewayPort | undefined,
): boolean {
  if (runner.kind !== 'agent') return false;
  if (runner.status === 'draining') return false;
  if (runner.status !== 'online') return false;
  return gateway?.isConnected(runner.id) === true;
}

function loadFactor(runner: RunnerRecord): number {
  if (runner.maxConcurrent <= 0) return Number.POSITIVE_INFINITY;
  return runner.runningJobs / runner.maxConcurrent;
}

function compareAgents(a: RunnerRecord, b: RunnerRecord): number {
  const loadDiff = loadFactor(a) - loadFactor(b);
  if (loadDiff !== 0) return loadDiff;
  const aHeartbeat = a.lastHeartbeatAt?.getTime() ?? 0;
  const bHeartbeat = b.lastHeartbeatAt?.getTime() ?? 0;
  return bHeartbeat - aHeartbeat;
}

function filterAgentCandidates(
  runners: RunnerRecord[],
  policy: RunnerPolicy,
  requirements: ResolveRunnerRequirements | undefined,
  requirePolicyLabels: boolean,
  gateway: RunnerGatewayPort | undefined,
): RunnerRecord[] {
  const labelFilter = requirePolicyLabels ? policy.labels : policy.labels;
  return runners
    .filter((r) => isAgentCandidate(r, gateway))
    .filter((r) => matchesPolicyPlatform(r, policy.platform))
    .filter((r) => isStringSuperset(r.labels, labelFilter))
    .filter((r) => isStringSuperset(r.capabilities, requirements?.capabilities))
    .sort(compareAgents);
}

function noRunnerError(): AwfError {
  return new AwfError(E2010, 'No runner available');
}

export function createRunnerDispatcher(deps: {
  runnerRepository: RunnerRepositoryPort;
  runnerGateway?: RunnerGatewayPort;
}) {
  async function resolveEmbedded(): Promise<RunnerRecord> {
    const online = await deps.runnerRepository.listOnline({ kind: 'embedded' });
    const embedded = online.find((r) => r.kind === 'embedded');
    if (!embedded) {
      throw new AwfError(E2010, 'No embedded runner available');
    }
    return embedded;
  }

  async function pickBestAgent(
    policy: RunnerPolicy,
    requirements: ResolveRunnerRequirements | undefined,
    requirePolicyLabels: boolean,
  ): Promise<RunnerRecord | null> {
    const online = await deps.runnerRepository.listOnline();
    const candidates = filterAgentCandidates(
      online,
      policy,
      requirements,
      requirePolicyLabels,
      deps.runnerGateway,
    );
    return candidates[0] ?? null;
  }

  async function resolvePinned(policy: RunnerPolicy): Promise<RunnerRecord> {
    const runnerId = policy.runnerId;
    if (!runnerId) {
      throw noRunnerError();
    }
    const runner = await deps.runnerRepository.findById(runnerId);
    if (!runner) {
      if (policy.fallback === 'embedded') {
        return resolveEmbedded();
      }
      throw noRunnerError();
    }
    if (runner.kind === 'embedded') {
      return runner;
    }
    if (
      runner.kind === 'agent' &&
      runner.status === 'online' &&
      deps.runnerGateway?.isConnected(runner.id) === true
    ) {
      return runner;
    }
    if (policy.fallback === 'embedded') {
      return resolveEmbedded();
    }
    throw noRunnerError();
  }

  async function resolveAutoOrLabel(
    policy: RunnerPolicy,
    requirements: ResolveRunnerRequirements | undefined,
    requirePolicyLabels: boolean,
  ): Promise<RunnerRecord> {
    const agent = await pickBestAgent(policy, requirements, requirePolicyLabels);
    if (agent) {
      return agent;
    }
    if (policy.fallback === 'embedded') {
      return resolveEmbedded();
    }
    throw noRunnerError();
  }

  return {
    async resolve(input: ResolveRunnerInput): Promise<ResolvedRunner> {
      const policy = input.effectivePolicy;

      if (policy.mode === 'embedded') {
        return resolveEmbedded();
      }

      if (policy.mode === 'pinned') {
        return resolvePinned(policy);
      }

      if (policy.mode === 'label') {
        return resolveAutoOrLabel(policy, input.requirements, true);
      }

      return resolveAutoOrLabel(policy, input.requirements, false);
    },
  };
}
