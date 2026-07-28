import { t, useLabels } from '../../i18n/labels.js';
import { useEffect } from 'react';
import { Select } from '../../components/Select.js';
import {
  collectRunnerLabelSuggestions,
  defaultPinnedRunnerId,
  getNodeCapabilityHints,
  normalizeNodeRunnerMode,
  normalizeRunnerPolicyMode,
  parseNodeRunnerOverride,
  type NodeRunnerOverride,
  type RunnerOs,
  type RunnerPolicy,
  type RunnerPreviewOption,
} from './runner-policy-types.js';

export type RunnerOption = RunnerPreviewOption;

type WorkflowSelectMode = 'embedded' | 'auto' | 'pinned';
type NodeSelectMode = 'inherit' | 'auto' | 'pinned';

const PLATFORM_DISPLAY_LABELS: Record<RunnerOs, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
};

const PLATFORM_OPTIONS: Array<{ value: '' | RunnerOs; labelKey: string | null }> = [
  { value: '', labelKey: 'auto.t_623a8d38' },
  { value: 'windows', labelKey: null },
  { value: 'linux', labelKey: null },
  { value: 'macos', labelKey: null },
];

function parseLabelsInput(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function withWorkflowFailFallback(policy: RunnerPolicy): RunnerPolicy {
  if (policy.mode === 'embedded') {
    const { fallback: _fallback, ...rest } = policy;
    return rest;
  }
  return { ...policy, fallback: 'fail' };
}

function PoolFiltersEditor({
  platform,
  labels,
  labelSuggestions,
  onPlatformChange,
  onLabelsChange,
}: {
  platform?: RunnerOs;
  labels?: string[];
  labelSuggestions: string[];
  onPlatformChange: (platform: RunnerOs | undefined) => void;
  onLabelsChange: (labels: string[] | undefined) => void;
}) {
  const uiLabels = useLabels();
  const labelText = (labels ?? []).join(', ');

  return (
    <div className="runner-compact-pool-filters">
      <div className="runner-compact-platform-select">
        <Select
          value={platform ?? ''}
          aria-label={t(uiLabels, 'runners.compact.platform')}
          onChange={(next) =>
            onPlatformChange(next === '' ? undefined : (next as RunnerOs))
          }
          options={PLATFORM_OPTIONS.map((p) => ({
            value: p.value,
            label: p.labelKey
              ? t(uiLabels, p.labelKey)
              : p.value
                ? PLATFORM_DISPLAY_LABELS[p.value]
                : '',
          }))}
        />
      </div>
      <input
        type="text"
        list="runner-label-suggestions"
        value={labelText}
        aria-label={t(uiLabels, 'runners.compact.labels')}
        placeholder={t(uiLabels, 'runners.compact.labelsPlaceholder')}
        onChange={(e) => {
          const parsed = parseLabelsInput(e.target.value);
          onLabelsChange(parsed.length > 0 ? parsed : undefined);
        }}
      />
      {labelSuggestions.length > 0 && (
        <datalist id="runner-label-suggestions">
          {labelSuggestions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function RunnerNodeRequirementHints({
  nodeType,
}: {
  nodeType: string;
}) {
  const uiLabels = useLabels();
  const capabilityHints = getNodeCapabilityHints(nodeType);

  return (
    <div className="runner-compact-requirement-hints">
      <p className="hint">
        {t(uiLabels, 'runners.compact.capabilities')}:{' '}
        <strong>
          {capabilityHints.length > 0
            ? capabilityHints.join(', ')
            : t(uiLabels, 'runners.compact.noCapabilities')}
        </strong>
      </p>
    </div>
  );
}

function RunnerPinnedSelect({
  runnerId,
  runners,
  onChange,
}: {
  runnerId?: string;
  runners: RunnerOption[];
  onChange: (runnerId: string) => void;
}) {
  const uiLabels = useLabels();
  const agents = runners.filter((r) => r.kind !== 'embedded');
  const embedded = runners.filter((r) => r.kind === 'embedded');
  const defaultRunnerId = defaultPinnedRunnerId(runners);
  const resolvedRunnerId = runnerId ?? defaultRunnerId ?? '';

  useEffect(() => {
    if (!runnerId && defaultRunnerId) {
      onChange(defaultRunnerId);
    }
  }, [runnerId, defaultRunnerId, onChange]);

  return (
    <Select
      value={resolvedRunnerId}
      aria-label={t(uiLabels, 'auto.Runner_033073e3')}
      onChange={onChange}
      options={[
        ...embedded.map((r) => ({
          value: r.id,
          label: `${r.name}${t(uiLabels, 'runners.builtinSuffix')}`,
        })),
        ...agents.map((r) => ({
          value: r.id,
          label: `${r.name} (${r.status})`,
        })),
      ]}
    />
  );
}

export function RunnerCompactEditor(
  props:
    | {
        variant: 'workflow';
        runners: RunnerOption[];
        policy: RunnerPolicy;
        onChange: (policy: RunnerPolicy) => void;
      }
    | {
        variant: 'node';
        runners: RunnerOption[];
        node: { type: string; runner?: unknown };
        workflowRunnerPolicy: RunnerPolicy;
        onChange: (override: NodeRunnerOverride) => void;
      },
) {
  const uiLabels = useLabels();
  const labelSuggestions = collectRunnerLabelSuggestions(props.runners);

  if (props.variant === 'workflow') {
    const { policy, onChange, runners } = props;
    const mode = normalizeRunnerPolicyMode(policy.mode) as WorkflowSelectMode;

    const updateWorkflowPolicy = (patch: RunnerPolicy) => {
      onChange(withWorkflowFailFallback(patch));
    };

    const setWorkflowMode = (nextMode: WorkflowSelectMode) => {
      const patch: RunnerPolicy = {
        ...policy,
        mode: nextMode,
      };
      if (nextMode !== 'pinned') {
        delete patch.runnerId;
      } else {
        patch.runnerId = policy.runnerId ?? defaultPinnedRunnerId(runners);
      }
      if (nextMode !== 'auto') {
        delete patch.platform;
        delete patch.labels;
      }
      updateWorkflowPolicy(patch);
    };

    return (
      <section className="runner-param-section">
        <h5 className="runner-param-section-title">{t(uiLabels, 'runners.policy.title')}</h5>
        <div className="runner-param-section-box runner-compact runner-policy">
        <div className="runner-compact-row">
          <div className="runner-compact-mode-select">
            <Select
              value={mode}
              aria-label={t(uiLabels, 'runners.compact.mode')}
              onChange={(next) => setWorkflowMode(next as WorkflowSelectMode)}
              options={[
                { value: 'embedded', label: t(uiLabels, 'runners.compact.default') },
                { value: 'auto', label: t(uiLabels, 'auto.t_fa3d2783') },
                { value: 'pinned', label: t(uiLabels, 'editor.mode.fixed') },
              ]}
            />
          </div>
          <div className="runner-compact-right">
            {mode === 'embedded' && (
              <p className="hint">{t(uiLabels, 'runners.compact.embeddedHint')}</p>
            )}
            {mode === 'auto' && (
              <PoolFiltersEditor
                platform={policy.platform}
                labels={policy.labels}
                labelSuggestions={labelSuggestions}
                onPlatformChange={(platform) =>
                  updateWorkflowPolicy({ ...policy, platform })
                }
                onLabelsChange={(labels) =>
                  updateWorkflowPolicy({ ...policy, labels })
                }
              />
            )}
            {mode === 'pinned' && (
              <RunnerPinnedSelect
                runnerId={policy.runnerId}
                runners={runners}
                onChange={(runnerId) =>
                  updateWorkflowPolicy({ ...policy, runnerId })
                }
              />
            )}
          </div>
        </div>
        </div>
      </section>
    );
  }

  const { node, onChange, runners } = props;
  const override = parseNodeRunnerOverride(node);
  const uiMode = normalizeNodeRunnerMode(override.mode) as NodeSelectMode;

  const setNodeMode = (nextMode: NodeSelectMode) => {
    const next: NodeRunnerOverride = { mode: nextMode };
    if (nextMode === 'pinned') {
      next.runnerId = override.runnerId ?? defaultPinnedRunnerId(runners);
    }
    if (nextMode === 'auto') {
      if (override.platform) next.platform = override.platform;
      if (override.labels?.length) next.labels = override.labels;
    }
    onChange(next);
  };

  return (
    <section className="runner-param-section node-runner-override">
      <h5 className="runner-param-section-title">{t(uiLabels, 'runners.compact.nodeTitle')}</h5>
      <div className="runner-param-section-box runner-compact runner-policy">
      <div className="runner-compact-row">
        <div className="runner-compact-mode-select">
          <Select
            value={uiMode}
            aria-label={t(uiLabels, 'runners.compact.mode')}
            onChange={(next) => setNodeMode(next as NodeSelectMode)}
            options={[
              { value: 'inherit', label: t(uiLabels, 'runners.compact.default') },
              { value: 'auto', label: t(uiLabels, 'auto.t_fa3d2783') },
              { value: 'pinned', label: t(uiLabels, 'editor.mode.fixed') },
            ]}
          />
        </div>
        <div className="runner-compact-right">
          {uiMode === 'inherit' && (
            <p className="hint">{t(uiLabels, 'runners.compact.inheritHint')}</p>
          )}
          {uiMode === 'auto' && (
            <PoolFiltersEditor
              platform={override.platform}
              labels={override.labels}
              labelSuggestions={labelSuggestions}
              onPlatformChange={(platform) =>
                onChange({ ...override, mode: 'auto', platform })
              }
              onLabelsChange={(labels) =>
                onChange({ ...override, mode: 'auto', labels })
              }
            />
          )}
          {uiMode === 'pinned' && (
            <RunnerPinnedSelect
              runnerId={override.runnerId}
              runners={runners}
              onChange={(runnerId) =>
                onChange({ ...override, mode: 'pinned', runnerId })
              }
            />
          )}
        </div>
      </div>
      <RunnerNodeRequirementHints nodeType={node.type} />
      </div>
    </section>
  );
}
