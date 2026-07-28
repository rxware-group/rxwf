import { t, type LabelMap } from '../../i18n/labels.js';

export type RunnerPolicyMode = 'embedded' | 'auto' | 'pinned' | 'label';
export type RunnerPolicyFallback = 'fail' | 'embedded';
export type RunnerOs = 'windows' | 'linux' | 'macos';

/** Node types that never show per-node Runner override in the editor. */
export const RUNNER_OVERRIDE_EXCLUDED_NODE_TYPES = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
  'stickyNote',
  'aiAgent',
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
]);

export function nodeSupportsRunnerOverride(nodeType: string): boolean {
  return !RUNNER_OVERRIDE_EXCLUDED_NODE_TYPES.has(nodeType);
}

/** @deprecated Use `nodeHasRunnerRequirementHints` — capabilities-based dispatch replaces v1.1 allowlist. */
export function isRemoteV11NodeType(nodeType: string): boolean {
  return nodeHasRunnerRequirementHints(nodeType);
}
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

export const defaultRunnerPolicy = (): RunnerPolicy => ({ mode: 'embedded' });

function parseRunnerPolicyMode(value: unknown): RunnerPolicyMode {
  if (
    value === 'embedded' ||
    value === 'auto' ||
    value === 'pinned' ||
    value === 'label'
  ) {
    return value;
  }
  return 'embedded';
}

export function isDefaultEmbeddedPolicy(policy: RunnerPolicy): boolean {
  return (
    policy.mode === 'embedded' &&
    !policy.runnerId &&
    !policy.platform &&
    (!policy.labels || policy.labels.length === 0) &&
    (policy.fallback === undefined || policy.fallback === 'embedded')
  );
}

export function parseRunnerPolicy(settings?: Record<string, unknown>): RunnerPolicy {
  const raw = settings?.runnerPolicy;
  if (!raw || typeof raw !== 'object') {
    return defaultRunnerPolicy();
  }
  const p = raw as Record<string, unknown>;
  const rawMode = parseRunnerPolicyMode(p.mode);
  const mode = normalizeRunnerPolicyMode(rawMode);
  const policy: RunnerPolicy = {
    mode,
    runnerId: typeof p.runnerId === 'string' ? p.runnerId : undefined,
    platform:
      p.platform === 'windows' || p.platform === 'linux' || p.platform === 'macos'
        ? p.platform
        : undefined,
    labels: Array.isArray(p.labels)
      ? p.labels.filter((l): l is string => typeof l === 'string')
      : undefined,
  };
  if (mode !== 'embedded') {
    policy.fallback = 'fail';
  }
  return policy;
}

export function runnerPolicyToSettings(policy: RunnerPolicy): Record<string, unknown> {
  if (isDefaultEmbeddedPolicy(policy)) {
    return {};
  }
  return {
    runnerPolicy: {
      mode: policy.mode,
      ...(policy.runnerId ? { runnerId: policy.runnerId } : {}),
      ...(policy.platform ? { platform: policy.platform } : {}),
      ...(policy.labels?.length ? { labels: policy.labels } : {}),
      ...(policy.mode !== 'embedded' ? { fallback: 'fail' as const } : {}),
    },
  };
}

export function applyRunnerPolicyToSettings(
  settings: Record<string, unknown> | undefined,
  policy: RunnerPolicy,
): Record<string, unknown> {
  const next = { ...(settings ?? {}) };
  if (isDefaultEmbeddedPolicy(policy)) {
    delete next.runnerPolicy;
    return next;
  }
  return {
    ...next,
    ...runnerPolicyToSettings(policy),
  };
}

function parseNodeRunnerMode(value: unknown): NodeRunnerOverrideMode {
  if (
    value === 'inherit' ||
    value === 'embedded' ||
    value === 'auto' ||
    value === 'pinned' ||
    value === 'label'
  ) {
    return value;
  }
  return 'inherit';
}

export function parseNodeRunnerOverride(node: {
  runner?: unknown;
}): NodeRunnerOverride {
  const raw = node.runner;
  if (!raw || typeof raw !== 'object') {
    return { mode: 'inherit' };
  }
  const p = raw as Record<string, unknown>;
  return {
    mode: parseNodeRunnerMode(p.mode),
    runnerId: typeof p.runnerId === 'string' ? p.runnerId : undefined,
    platform:
      p.platform === 'windows' || p.platform === 'linux' || p.platform === 'macos'
        ? p.platform
        : undefined,
    labels: Array.isArray(p.labels)
      ? p.labels.filter((l): l is string => typeof l === 'string')
      : undefined,
  };
}

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

/** Map legacy label mode to auto for UI and effective policy. */
export function normalizeRunnerPolicyMode(mode: RunnerPolicyMode): RunnerPolicyMode {
  return mode === 'label' ? 'auto' : mode;
}

export function normalizeNodeRunnerMode(mode: NodeRunnerOverrideMode): NodeRunnerOverrideMode {
  if (mode === 'label') return 'auto';
  return mode;
}

/** Keep in sync with `@rxwf/node-runner` BUILTIN_NODE_RUNNER_REQUIREMENTS. */
const NODE_RUNNER_REQUIREMENT_HINTS: Record<
  string,
  { capabilities?: string[]; platforms?: string[] }
> = {
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

const RUNNER_PLATFORM_DISPLAY_LABELS: Record<RunnerOs, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
};

export function formatRunnerPlatformHints(platforms: string[]): string {
  return platforms
    .map((platform) =>
      platform === 'windows' || platform === 'linux' || platform === 'macos'
        ? RUNNER_PLATFORM_DISPLAY_LABELS[platform]
        : platform,
    )
    .join(', ');
}

export function getNodeRunnerRequirementHints(nodeType: string): {
  capabilities?: string[];
  platforms?: string[];
} {
  return NODE_RUNNER_REQUIREMENT_HINTS[nodeType] ?? {};
}

export function getNodeCapabilityHints(nodeType: string): string[] {
  return getNodeRunnerRequirementHints(nodeType).capabilities ?? [];
}

export function getNodePlatformHints(nodeType: string): string[] {
  return getNodeRunnerRequirementHints(nodeType).platforms ?? [];
}

export function nodeHasRunnerRequirementHints(nodeType: string): boolean {
  const hints = getNodeRunnerRequirementHints(nodeType);
  return (hints.capabilities?.length ?? 0) > 0 || (hints.platforms?.length ?? 0) > 0;
}

export function collectRunnerLabelSuggestions(
  runners: RunnerPreviewOption[],
): string[] {
  const set = new Set<string>();
  for (const runner of runners) {
    const labels = (runner as RunnerPreviewOption & { labels?: string[] }).labels;
    if (Array.isArray(labels)) {
      for (const label of labels) {
        if (label.trim()) set.add(label.trim());
      }
    }
  }
  return [...set].sort();
}

export function nodeRunnerOverrideToNodePatch(
  override: NodeRunnerOverride,
): Partial<{ runner: NodeRunnerOverride | undefined }> {
  if (override.mode === 'inherit') {
    return { runner: undefined };
  }
  const mode = normalizeNodeRunnerMode(override.mode);
  return {
    runner: {
      mode: mode === 'label' ? 'auto' : mode,
      ...(override.runnerId ? { runnerId: override.runnerId } : {}),
      ...(override.platform ? { platform: override.platform } : {}),
      ...(override.labels?.length ? { labels: override.labels } : {}),
    },
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

  const mode = normalizeNodeRunnerMode(nr.mode);
  const pool = mode === 'auto' ? mergePoolFilters(input.workflowRunnerPolicy, nr) : {};

  return {
    mode: mode as RunnerPolicyMode,
    runnerId: nr.runnerId,
    ...pool,
    fallback:
      mode === 'pinned'
        ? 'fail'
        : workflowFallback(input.workflowRunnerPolicy, global),
  };
}

export interface RunnerPreviewOption {
  id: string;
  name: string;
  status: string;
  kind: string;
  labels?: string[];
}

export function defaultPinnedRunnerId(
  runners: RunnerPreviewOption[],
): string | undefined {
  return runners.find((r) => r.kind === 'embedded')?.id;
}

export function describeEffectiveRunnerPolicy(
  effective: RunnerPolicy,
  runners: RunnerPreviewOption[],
): string {
  switch (effective.mode) {
    case 'embedded': {
      const embedded = runners.find((r) => r.kind === 'embedded');
      return embedded ? `Embedded (${embedded.name})` : 'Embedded';
    }
    case 'pinned': {
      if (!effective.runnerId) return 'Pinned (no runner selected)';
      const pinned = runners.find((r) => r.id === effective.runnerId);
      return pinned
        ? `Pinned: ${pinned.name} (${pinned.status})`
        : `Pinned: ${effective.runnerId}`;
    }
    case 'label': {
      const labels = (effective.labels ?? []).join(', ') || '(none)';
      return `Label match: ${labels}`;
    }
    case 'auto': {
      const platform = effective.platform ?? 'any';
      return `Auto (${platform})`;
    }
    default:
      return effective.mode;
  }
}

export function describeEffectiveRunnerPolicyLabels(
  labels: LabelMap,
  effective: RunnerPolicy,
  runners: RunnerPreviewOption[],
): string {
  switch (effective.mode) {
    case 'embedded': {
      const embedded = runners.find((r) => r.kind === 'embedded');
      return embedded
        ? t(labels, 'runners.policy.effectiveEmbedded', { name: embedded.name })
        : t(labels, 'auto.t_09ceea76');
    }
    case 'pinned': {
      if (!effective.runnerId) {
        return t(labels, 'runners.policy.effectivePinnedEmpty');
      }
      const pinned = runners.find((r) => r.id === effective.runnerId);
      if (pinned) {
        return t(labels, 'runners.policy.effectivePinned', {
          name: pinned.name,
          status: pinned.status,
        });
      }
      return t(labels, 'runners.policy.effectivePinnedId', {
        id: effective.runnerId,
      });
    }
    case 'label': {
      const labelList = (effective.labels ?? []).join(', ');
      return t(labels, 'runners.policy.effectiveLabel', {
        labels: labelList || t(labels, 'runners.policy.none'),
      });
    }
    case 'auto': {
      const platform = effective.platform ?? t(labels, 'auto.t_623a8d38');
      return t(labels, 'runners.policy.effectiveAuto', { platform });
    }
    default:
      return effective.mode;
  }
}