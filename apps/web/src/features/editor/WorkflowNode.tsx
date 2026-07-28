import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { resolveLabel } from '../../i18n/resolve-label.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getNodePorts, outputHandleToIndex, type PortDef } from './node-port-defs.js';
import { getNodeMeta } from './node-type-meta.js';
import type { NodeDebugState } from './editor-debug-types.js';
import { resolveNodeBodyBadge } from './node-run-badge.js';
import { MoreToolbarIcon, PlayToolbarIcon, PowerToolbarIcon, TrashToolbarIcon } from './NodeToolbarIcons.js';
import { NodeTypeIcon } from './NodeTypeIcon.js';

export type WorkflowNodeData = {
  label: string;
  nodeType: string;
  parameters: Record<string, unknown>;
  disabled?: boolean;
  readOnly?: boolean;
  debug?: NodeDebugState;
  onExecute?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onSelect?: (nodeId: string) => void;
  /** Mirrors workflow settings.enableCrew for port visibility. */
  enableCrew?: boolean;
};

const AGENT_TOOL_HUB_TYPES = new Set(['aiAgent', 'skillRun', 'toolSubagent']);

const AI_SATELLITE_TYPES = new Set([
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
  'toolSkill',
  'toolSubagent',
  'toolRead',
  'toolWrite',
  'toolGrep',
  'toolShell',
  'toolWebSearch',
]);

function handleVerticalSlot(index: number, total: number): string {
  if (total <= 1) return '50%';
  return `${((index + 1) / (total + 1)) * 100}%`;
}

function handleHorizontalSlot(index: number, total: number): string {
  if (total <= 1) return '50%';
  return `${((index + 1) / (total + 1)) * 100}%`;
}

function renderMarkdownPreview(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '$1')
    .replace(/^## (.+)$/gm, '$1')
    .replace(/^# (.+)$/gm, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .slice(0, 120);
}

function portLabelText(labels: LabelMap, p: PortDef): string {
  const label = resolveLabel(labels, p.label);
  return p.required ? `${label} *` : label;
}

function MainOutputLabels({
  labels,
  ports,
  debug,
  handleContext,
}: {
  labels: LabelMap;
  ports: PortDef[];
  debug?: NodeDebugState;
  handleContext?: { nodeType?: string; parameters?: Record<string, unknown> };
}) {
  if (ports.length <= 1) return null;
  return (
    <>
      {ports.map((p, i) => {
        const branchEmpty =
          debug?.status === 'success' &&
          (debug.outputItems?.[outputHandleToIndex(p.id, handleContext)]?.length ?? 0) === 0;
        return (
          <span
            key={`main-out-label-${p.id}`}
            className={
              branchEmpty
                ? 'workflow-node-main-out-label workflow-node-main-out-label--inactive'
                : 'workflow-node-main-out-label'
            }
            style={{ top: handleVerticalSlot(i, ports.length) }}
          >
            {resolveLabel(labels, p.label)}
          </span>
        );
      })}
    </>
  );
}

function ResourceInputPorts({ labels, ports }: { labels: LabelMap; ports: PortDef[] }) {
  return (
    <div className="workflow-node-resource-row workflow-node-resource-row--in">
      {ports.map((p) => (
        <div key={p.id} className="workflow-node-port-col">
          <span className="workflow-node-port-label">{portLabelText(labels, p)}</span>
          <Handle
            type="target"
            position={Position.Bottom}
            id={p.id}
            className="workflow-handle workflow-handle-resource workflow-handle-resource-in"
          />
        </div>
      ))}
    </div>
  );
}

function ResourceOutputPorts({
  labels,
  ports,
  showLabels = true,
}: {
  labels: LabelMap;
  ports: PortDef[];
  showLabels?: boolean;
}) {
  return (
    <div className="workflow-node-resource-row workflow-node-resource-row--out">
      {ports.map((p) => (
        <div key={p.id} className="workflow-node-port-col">
          <Handle
            type="source"
            position={Position.Top}
            id={p.id}
            className="workflow-handle workflow-handle-resource workflow-handle-resource-out"
          />
          {showLabels && (
            <span className="workflow-node-port-label">{portLabelText(labels, p)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function WorkflowNode({
 id, data, selected }: NodeProps) {
  const labels = useLabels();

  const d = data as WorkflowNodeData;
  const meta = getNodeMeta(d.nodeType);

  if (d.nodeType === 'stickyNote') {
    const content = String(d.parameters.content ?? '');
    return (
      <div
        className={`sticky-note-node ${selected ? 'is-selected' : ''}`}
        onClick={() => d.onSelect?.(id)}
      >
        <div className="sticky-note-body">
          <pre>{renderMarkdownPreview(content) || t(labels, 'auto.t_1d0b7b24')}</pre>
        </div>
        <span className="workflow-node-caption-title">{d.label}</span>
      </div>
    );
  }

  const ports = getNodePorts(d.nodeType, d.parameters, {
    enableCrew: d.enableCrew !== false,
  });
  const resourceInputs = ports.resourceInputs ?? [];
  const resourceOutputs = ports.resourceOutputs ?? [];
  const isAgent = d.nodeType === 'aiAgent';
  const isAgentToolHub = AGENT_TOOL_HUB_TYPES.has(d.nodeType);
  const isSatellite = AI_SATELLITE_TYPES.has(d.nodeType);

  const status = resolveNodeBodyBadge(labels, d.nodeType, d.debug);
  const statusClass = d.debug?.status ?? 'idle';
  const isDisabled = Boolean(d.disabled);
  const isRunning = d.debug?.status === 'running';
  const isTrigger = meta.category === 'trigger';
  const readOnly = Boolean(d.readOnly);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const switchOutCount = d.nodeType === 'switch' ? ports.outputs.length : 0;
  const bodyClass = [
    'workflow-node-body',
    `workflow-node-body--${meta.category}`,
    switchOutCount > 0 ? 'workflow-node-body--switch-out' : '',
    isAgentToolHub ? 'workflow-node-body--ai-agent' : '',
    isSatellite ? 'workflow-node-body--ai-satellite' : '',
    resourceInputs.length > 0 ? 'workflow-node-body--has-resource-in' : '',
    resourceOutputs.length > 0 ? 'workflow-node-body--has-resource-out' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const switchBodyStyle =
    switchOutCount > 0
      ? ({
          '--wf-switch-extra-outs': String(Math.max(0, switchOutCount - 1)),
        } as React.CSSProperties)
      : undefined;

  const wrapClass = [
    'workflow-node-wrap',
    `workflow-node-wrap--${statusClass}`,
    selected ? 'is-selected' : '',
    isDisabled ? 'is-disabled' : '',
    isAgentToolHub ? 'workflow-node-wrap--ai-agent' : '',
    resourceInputs.length > 0 ? 'workflow-node-wrap--resource-in' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <div className="workflow-node-interaction">
      <div
        className={`workflow-node-toolbar nodrag nopan${menuOpen ? ' is-visible' : ''}`}
        ref={menuRef}
      >
        {!readOnly && (
          <>
        <button
          type="button"
          className="workflow-node-btn workflow-node-btn--play nodrag"
          title={t(labels, 'auto.t_1653f230')}
          disabled={isDisabled || isRunning}
          onClick={(e) => {
            e.stopPropagation();
            d.onExecute?.(id);
          }}
        >
          <PlayToolbarIcon />
        </button>
        <button
          type="button"
          className={`workflow-node-btn nodrag ${isDisabled ? 'is-off' : ''}`}
          title={isDisabled ? t(labels, 'auto.t_f0ba1b23') : t(labels, 'auto.t_39017dbe')}
          onClick={(e) => {
            e.stopPropagation();
            d.onToggleDisabled?.(id);
          }}
        >
          <PowerToolbarIcon off={isDisabled} />
        </button>
        <button
          type="button"
          className="workflow-node-btn workflow-node-btn--danger nodrag"
          title={t(labels, 'auto.t_ff37dc39')}
          onClick={(e) => {
            e.stopPropagation();
            d.onDelete?.(id);
          }}
        >
          <TrashToolbarIcon />
        </button>
        <div className="workflow-node-more-wrap">
          <button
            type="button"
            className={`workflow-node-btn nodrag ${menuOpen ? 'is-active' : ''}`}
            title={t(labels, 'auto.t_77836d3a')}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
              d.onSelect?.(id);
            }}
          >
            <MoreToolbarIcon />
          </button>
          {menuOpen && (
            <div className="workflow-node-menu nodrag" role="menu">
              <button
                type="button"
                role="menuitem"
                className="nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  d.onDuplicate?.(id);
                }}
              >{t(labels, 'editor.copyNode')}</button>
              <button
                type="button"
                role="menuitem"
                className="danger nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  d.onDelete?.(id);
                }}
              >{t(labels, 'editor.deleteNode')}</button>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <div className="workflow-node-stack">
        {isTrigger && (
          <span className="workflow-node-trigger-bolt" title={t(labels, 'auto.t_2d189a3f')} aria-hidden>
            ⚡
          </span>
        )}
        <div
          className={bodyClass}
          style={
            {
              '--node-accent': meta.accent,
              ...switchBodyStyle,
            } as React.CSSProperties
          }
        >
          {resourceOutputs.length > 0 && (
            <ResourceOutputPorts
              labels={labels}
              ports={resourceOutputs}
              showLabels={!isSatellite || resourceOutputs.length > 1}
            />
          )}
          {ports.inputs.map((p, i) => (
            <Handle
              key={p.id}
              type="target"
              position={Position.Left}
              id={p.id}
              className="workflow-handle workflow-handle-in"
              style={{ top: handleVerticalSlot(i, ports.inputs.length) }}
            />
          ))}

          <div className="workflow-node-icon-center">
            <NodeTypeIcon type={d.nodeType} meta={meta} />
          </div>

          {ports.outputs.map((p, i) => (
            <Handle
              key={p.id}
              type="source"
              position={Position.Right}
              id={p.id}
              className="workflow-handle workflow-handle-out"
              style={{ top: handleVerticalSlot(i, ports.outputs.length) }}
            />
          ))}

          <MainOutputLabels
            labels={labels}
            ports={ports.outputs}
            debug={d.debug}
            handleContext={{ nodeType: d.nodeType, parameters: d.parameters }}
          />

          {resourceInputs.length > 0 && (
            <ResourceInputPorts labels={labels} ports={resourceInputs} />
          )}

          {status && !isDisabled && (
            <span className={`workflow-node-badge workflow-node-badge--${statusClass}`}>
              {isRunning ? (
                <LoadingSpinner size="sm" label={t(labels, 'common.running')} />
              ) : (
                status
              )}
            </span>
          )}
        </div>

        <div className="workflow-node-caption">
          <span className="workflow-node-caption-title">{d.label}</span>
        </div>

        {isDisabled && <span className="workflow-node-caption-muted">{t(labels, 'editor.nodeDisabled')}</span>}
        {d.debug?.status === 'failed' && d.debug.errorMessage && (
          <span className="workflow-node-caption-error" title={d.debug.errorMessage}>
            {d.debug.errorMessage}
          </span>
        )}
      </div>
      </div>
    </div>
  );
}
