import { useEffect, useRef, useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import {
  createSwitchBranch,
  defaultSwitchParameters,
  parseSwitchBranches,
  type SwitchBranch,
} from './switch-branches.js';
import type { WorkflowDefinition } from '../../api/client.js';
import { ParamTemplateField } from './ParamTemplateField.js';
import { TrashToolbarIcon } from './NodeToolbarIcons.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];

function defaultPortLabel(index: number): string {
  return `端口${index + 1}`;
}

function displayPortLabel(branch: SwitchBranch, index: number): string {
  return branch.label.trim() || defaultPortLabel(index);
}

function SwitchBranchToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="switch-branch-toggle-icon"
      viewBox="0 0 22 22"
      width="22"
      height="22"
      aria-hidden
    >
      {expanded ? (
        <path
          d="M5.5 8.25 11 13.75 16.5 8.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8.25 5.5 13.75 11 8.25 16.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function SwitchBranchRow({
  branch,
  index,
  canDelete,
  expanded,
  onToggleExpanded,
  onUpdate,
  onRemove,
}: {
  branch: SwitchBranch;
  index: number;
  canDelete: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (patch: Partial<SwitchBranch>) => void;
  onRemove: () => void;
}) {
  const labels = useLabels();
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const title = displayPortLabel(branch, index);

  useEffect(() => {
    if (!editingLabel) return;
    labelInputRef.current?.focus();
    labelInputRef.current?.select();
  }, [editingLabel]);

  const startLabelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLabel(true);
  };

  return (
    <li
      className={`switch-branch-row${expanded ? ' is-expanded' : ' is-collapsed'}`}
    >
      <div className="switch-branch-row-head">
        <button
          type="button"
          className="switch-branch-toggle"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t(labels, 'editor.switch.collapseBranch')
              : t(labels, 'editor.switch.expandBranch')
          }
          onClick={onToggleExpanded}
        >
          <SwitchBranchToggleIcon expanded={expanded} />
        </button>
        <span className="switch-branch-index">{index + 1}</span>
        <div className="switch-branch-title-wrap">
          {editingLabel ? (
            <input
              ref={labelInputRef}
              className="switch-branch-title-input"
              type="text"
              size={Math.min(24, Math.max(4, (branch.label || title).length + 1))}
              value={branch.label}
              placeholder={defaultPortLabel(index)}
              onChange={(e) => onUpdate({ label: e.target.value })}
              onBlur={() => setEditingLabel(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setEditingLabel(false);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingLabel(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span
                className="switch-branch-title-text"
                role="button"
                tabIndex={0}
                title={t(labels, 'editor.switch.editPortLabel')}
                onClick={startLabelEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setEditingLabel(true);
                  }
                }}
              >
                {title}
              </span>
              <button
                type="button"
                className="switch-branch-title-edit-icon"
                aria-label={t(labels, 'editor.switch.editPortLabel')}
                onClick={startLabelEdit}
              >
                ✎
              </button>
            </>
          )}
        </div>
        {canDelete ? (
          <button
            type="button"
            className="switch-branch-remove"
            aria-label={t(labels, 'common.delete')}
            title={t(labels, 'common.delete')}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <TrashToolbarIcon />
          </button>
        ) : (
          <span className="switch-branch-remove-placeholder" aria-hidden />
        )}
      </div>
      {expanded ? (
        <div className="switch-branch-row-body">
          <ParamTemplateField
            label={t(labels, 'editor.switch.condition')}
            value={branch.condition}
            multiline
            placeholder="{{ $json.status === 'paid' }}"
            onValueChange={(v) => onUpdate({ condition: v })}
          />
        </div>
      ) : null}
    </li>
  );
}

export function SwitchBranchesPanel({
  node,
  onUpdateParameters,
  onPatchWorkflow,
}: {
  node: WorkflowNode;
  onUpdateParameters: (parameters: Record<string, unknown>) => void;
  /** 同步更新节点参数并清理已删分支的连线（不走 workflow_run 导入确认）。 */
  onPatchWorkflow: (
    updater: (definition: WorkflowDefinition) => WorkflowDefinition,
  ) => void;
}) {
  const labels = useLabels();
  const branches = parseSwitchBranches(node.parameters);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (branches.length > 0) return;
    onUpdateParameters({ ...node.parameters, ...defaultSwitchParameters() });
  }, [node.id, branches.length, node.parameters, onUpdateParameters]);

  useEffect(() => {
    setExpandedById((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (let i = 0; i < branches.length; i++) {
        const id = branches[i]!.id;
        if (id in prev) {
          next[id] = prev[id]!;
        } else {
          next[id] = i === branches.length - 1;
          changed = true;
        }
      }
      if (Object.keys(prev).length !== branches.length) changed = true;
      return changed ? next : prev;
    });
  }, [branches]);

  const commitBranches = (next: SwitchBranch[]) => {
    onUpdateParameters({ ...node.parameters, branches: next });
  };

  const updateBranch = (id: string, patch: Partial<SwitchBranch>) => {
    commitBranches(
      branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  };

  const addBranch = () => {
    const created = createSwitchBranch(branches.length);
    commitBranches([...branches, created]);
    setExpandedById((prev) => ({ ...prev, [created.id]: true }));
  };

  const removeBranch = (id: string) => {
    if (branches.length <= 1) return;
    const next = branches.filter((b) => b.id !== id);
    const nextParams = { ...node.parameters, branches: next };
    setExpandedById((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    onPatchWorkflow((definition) => ({
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === node.id ? { ...n, parameters: nextParams } : n,
      ),
      connections: definition.connections.filter(
        (c) => !(c.from === node.id && c.fromOutput === id),
      ),
    }));
  };

  const isExpanded = (id: string, index: number) =>
    expandedById[id] ?? index === 0;

  return (
    <div className="switch-branches-panel">
      <p className="hint switch-branches-hint">{t(labels, 'editor.switch.matchOrderHint')}</p>
      <ul className="switch-branches-list">
        {branches.map((branch, index) => (
          <SwitchBranchRow
            key={branch.id}
            branch={branch}
            index={index}
            canDelete={branches.length > 1}
            expanded={isExpanded(branch.id, index)}
            onToggleExpanded={() =>
              setExpandedById((prev) => ({
                ...prev,
                [branch.id]: !(prev[branch.id] ?? index === 0),
              }))
            }
            onUpdate={(patch) => updateBranch(branch.id, patch)}
            onRemove={() => removeBranch(branch.id)}
          />
        ))}
      </ul>
      <button type="button" className="btn-secondary switch-branch-add" onClick={addBranch}>
        {t(labels, 'editor.switch.addBranch')}
      </button>
    </div>
  );
}
