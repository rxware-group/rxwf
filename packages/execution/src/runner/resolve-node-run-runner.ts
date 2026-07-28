import {
  getNodeRunnerRequirements,
  type ResolveRunnerRequirements,
} from '@rxwf/node-runner';
import {
  GLOBAL_DEFAULT_RUNNER_POLICY,
  resolveEffectiveRunnerPolicy,
  type RunnerPolicy,
  type WorkflowDefinition,
} from '@rxwf/workflow';

function parseRunnerPolicy(raw: unknown): RunnerPolicy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const mode = p.mode;
  if (
    mode !== 'embedded' &&
    mode !== 'auto' &&
    mode !== 'pinned' &&
    mode !== 'label'
  ) {
    return undefined;
  }
  return {
    mode,
    runnerId: typeof p.runnerId === 'string' ? p.runnerId : undefined,
    platform:
      p.platform === 'windows' || p.platform === 'linux' || p.platform === 'macos'
        ? p.platform
        : undefined,
    labels: Array.isArray(p.labels)
      ? p.labels.filter((l): l is string => typeof l === 'string')
      : undefined,
    fallback: p.fallback === 'fail' ? 'fail' : p.fallback === 'embedded' ? 'embedded' : undefined,
  };
}

export function resolveNodeRunRunnerContext(input: {
  workflowDefinition?: WorkflowDefinition;
  workflowSettings?: Record<string, unknown>;
  nodeRunId: string;
  nodeType: string;
}): {
  effectivePolicy: RunnerPolicy;
  runnerRequirements?: ResolveRunnerRequirements;
} {
  const definition = input.workflowDefinition;
  const workflowRunnerPolicy =
    definition?.settings?.runnerPolicy ??
    parseRunnerPolicy(input.workflowSettings?.runnerPolicy);

  const node = definition?.nodes.find((n) => n.id === input.nodeRunId);
  const nodeRunner = node?.runner;

  const effectivePolicy = resolveEffectiveRunnerPolicy({
    workflowRunnerPolicy,
    nodeRunner,
    globalPolicy: GLOBAL_DEFAULT_RUNNER_POLICY,
  });

  return {
    effectivePolicy,
    runnerRequirements: getNodeRunnerRequirements(input.nodeType),
  };
}
