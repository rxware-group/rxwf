export type RunnerPolicyMode = 'embedded' | 'auto' | 'pinned' | 'label';
export type RunnerPolicyFallback = 'fail' | 'embedded';
export type RunnerOs = 'windows' | 'linux' | 'macos';

export interface RunnerPolicy {
  mode: RunnerPolicyMode;
  runnerId?: string;
  platform?: RunnerOs;
  labels?: string[];
  fallback?: RunnerPolicyFallback;
}

export type NodeRunnerOverrideMode = 'inherit' | RunnerPolicyMode;

export interface NodeRunnerOverride {
  mode: NodeRunnerOverrideMode;
  runnerId?: string;
  platform?: RunnerOs;
  labels?: string[];
}

export const GLOBAL_DEFAULT_RUNNER_POLICY: RunnerPolicy = { mode: 'embedded' };

function workflowFallback(
  workflowRunnerPolicy?: RunnerPolicy,
  global?: RunnerPolicy,
): RunnerPolicyFallback {
  return workflowRunnerPolicy?.fallback ?? global?.fallback ?? 'embedded';
}

function mergePoolFilters(
  workflowRunnerPolicy: RunnerPolicy | undefined,
  nodeRunner: NodeRunnerOverride,
): Pick<RunnerPolicy, 'platform' | 'labels'> {
  const wf = workflowRunnerPolicy;
  return {
    platform: nodeRunner.platform ?? wf?.platform,
    labels:
      nodeRunner.labels !== undefined && nodeRunner.labels.length > 0
        ? nodeRunner.labels
        : wf?.labels,
  };
}

export function resolveEffectiveRunnerPolicy(input: {
  nodeRunner?: NodeRunnerOverride;
  workflowRunnerPolicy?: RunnerPolicy;
  globalPolicy?: RunnerPolicy;
}): RunnerPolicy {
  const global = input.globalPolicy ?? GLOBAL_DEFAULT_RUNNER_POLICY;
  const workflow = input.workflowRunnerPolicy ?? global;

  const nr = input.nodeRunner;
  if (!nr || nr.mode === 'inherit') {
    return workflow;
  }

  const mode = nr.mode === 'label' ? 'auto' : nr.mode;
  const pool = mode === 'auto' ? mergePoolFilters(input.workflowRunnerPolicy, nr) : {};

  return {
    mode,
    runnerId: nr.runnerId,
    ...pool,
    fallback:
      mode === 'pinned'
        ? 'fail'
        : workflowFallback(input.workflowRunnerPolicy, global),
  };
}
