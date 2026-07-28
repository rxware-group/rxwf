import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowDefinition } from '../../api/client.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import type { NodeDebugState, PinDataMap } from './editor-debug-types.js';
import type { WebhookListenError } from './webhook-listen-error.js';
import { getNodeMeta } from './node-type-meta.js';
import { NodeIconGlyph } from './NodeIconGlyph.js';
import { isTriggerNodeType } from './node-port-defs.js';
import { findDuplicateNodeName } from './unique-node-name.js';
import {
  initialModalSplit,
  modalSplitGridColumns,
  type ModalColumnWeights,
} from './node-editor-split.js';
import { useHorizontalSplitter } from './use-horizontal-splitter.js';
import { useDraggableModalPanel } from '../../hooks/use-draggable-modal-panel.js';
import { Tooltip } from '../../components/Tooltip.js';
import { ModalMaximizeButton, modalMaximizedPanelStyle } from '../../components/ModalMaximizeButton.js';
import { buildHelpUrl } from './build-help-url.js';
import { InputDataPanel } from './InputDataPanel.js';
import { NodeEditorParamsPane } from './NodeEditorParamsPane.js';
import { NodeEditorOutputPane } from './NodeEditorOutputPane.js';
import type { ExecuteNodeFn, ExecutePredecessorsFn } from './execute-node.js';
import type { RunnerPolicy } from '../runners/runner-policy-types.js';
import type { RunnerOption } from '../runners/RunnerCompactEditor.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];

export function NodeEditorModal({
  definition,
  nodeId,
  workflowId,
  publicUrl,
  published,
  nodeDebug,
  pinData,
  pinBranchData = {},
  onSplitChange,
  onClose,
  onUpdateNode,
  onExecuteNode,
  onExecutePredecessors,
  jsonDrafts,
  onJsonDraftChange,
  jsonError,
  blockClose,
  workflowRunnerPolicy,
  runnerOptions,
  onReplaceWorkflowDefinition,
  onPatchWorkflowDefinition,
  webhookListenErrors = {},
}: {
  definition: WorkflowDefinition;
  nodeId: string;
  workflowId: string;
  publicUrl: string;
  published: boolean;
  nodeDebug: Record<string, NodeDebugState>;
  pinData: PinDataMap;
  pinBranchData?: PinBranchDataMap;
  webhookListenErrors?: Record<string, WebhookListenError | undefined>;
  onSplitChange: (split: ModalColumnWeights) => void;
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onExecuteNode: ExecuteNodeFn;
  onExecutePredecessors: ExecutePredecessorsFn;
  jsonDrafts: Record<string, string>;
  onJsonDraftChange: (key: string, text: string) => void;
  jsonError: string | null;
  blockClose: boolean;
  workflowRunnerPolicy: RunnerPolicy;
  runnerOptions: RunnerOption[];
  onReplaceWorkflowDefinition?: (definition: WorkflowDefinition) => void;
  onPatchWorkflowDefinition?: (
    updater: (definition: WorkflowDefinition) => WorkflowDefinition,
  ) => void;
}) {
  const labels = useLabels();

  const node = definition.nodes.find((n) => n.id === nodeId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const hideInputPane = node ? isTriggerNodeType(node.type) : false;
  const { widths, setWidths, onDragDivider } = useHorizontalSplitter(
    initialModalSplit(hideInputPane),
  );

  const maximizedPanelStyle = modalMaximizedPanelStyle();

  const { panelStyle, headerProps } = useDraggableModalPanel(dialogRef, {
    open: true,
    disabled: blockClose || maximized,
  });

  useEffect(() => {
    if (!node) return;
    setWidths(initialModalSplit(isTriggerNodeType(node.type)));
  }, [nodeId, node?.type, setWidths]);

  useEffect(() => {
    setEditingTitle(false);
    setMaximized(false);
  }, [nodeId]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTitle) {
          setEditingTitle(false);
          return;
        }
        if (blockClose) return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, blockClose, editingTitle]);

  const startDividerDrag = useCallback(
    (index: 0 | 1) => (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = splitContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const twoColumn = hideInputPane;
      const move = (ev: MouseEvent) =>
        onDragDivider(index, ev.clientX, rect, twoColumn);
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        setWidths((w) => {
          onSplitChange(w);
          return w;
        });
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [hideInputPane, onDragDivider, onSplitChange, setWidths],
  );

  if (!node) return null;

  const meta = getNodeMeta(node.type);
  const duplicateName = findDuplicateNodeName(definition.nodes, node.id);
  const gridColumns = modalSplitGridColumns(widths, hideInputPane);

  const startTitleEdit = () => setEditingTitle(true);

  return createPortal(
    <div className="rxwf-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className={`rxwf-modal rxwf-modal--draggable rxwf-modal--lg node-editor-modal${maximized ? ' node-editor-modal--maximized rxwf-modal--maximized' : ''}`}
        style={maximized ? { ...panelStyle, ...maximizedPanelStyle } : panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-editor-title"
        tabIndex={-1}
      >
        <header
          className="rxwf-modal-header rxwf-modal-header--draggable node-editor-modal-header"
          {...headerProps}
        >
          <span className="node-panel-icon">
            <NodeIconGlyph type={node.type} meta={meta} className="rxwf-node-glyph" />
          </span>
          <div className="node-editor-title-wrap">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                id="node-editor-title"
                className="node-editor-title-input"
                type="text"
                size={Math.min(32, Math.max(4, node.name.length + 1))}
                value={node.name}
                onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <>
                <span
                  id="node-editor-title"
                  className="node-editor-title-text"
                  role="button"
                  tabIndex={0}
                  onClick={startTitleEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      startTitleEdit();
                    }
                  }}
                >
                  {node.name.trim() || t(labels, 'auto.t_35563060')}
                </span>
                <button
                  type="button"
                  className="node-editor-title-edit-icon"
                  aria-label={t(labels, 'auto.t_fe7847b3')}
                  onClick={startTitleEdit}
                >
                  ✎
                </button>
              </>
            )}
          </div>
          <div className="rxwf-modal-header-actions node-editor-modal-header-actions">
            <Tooltip label={t(labels, 'help.openContext')} side="bottom">
              <button
                type="button"
                className="rxwf-modal-close rxwf-modal-help-btn"
                aria-label={t(labels, 'help.openContext')}
                onClick={() => {
                  const url = buildHelpUrl({ nodeType: node.type });
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <svg
                  className="rxwf-modal-help-icon"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M10 9.5a2 2 0 0 1 4 1.25c0 1.5-2 1.5-2 2.75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16.5" r="0.85" fill="currentColor" />
                </svg>
              </button>
            </Tooltip>
            <ModalMaximizeButton
              maximized={maximized}
              onToggle={() => setMaximized((value) => !value)}
            />
            <Tooltip label={t(labels, 'common.close')} side="bottom">
              <button
                type="button"
                className="rxwf-modal-close node-editor-close-btn"
                aria-label={t(labels, 'common.close')}
                onClick={() => {
                  if (blockClose) return;
                  onClose();
                }}
              >
                <svg className="node-editor-close-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                  <path
                    d="M5.75 5.75L18.25 18.25M18.25 5.75L5.75 18.25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </Tooltip>
          </div>
        </header>
        {(duplicateName || !node.name.trim()) && (
          <p className="error node-editor-name-error">
            {duplicateName
              ? t(labels, 'editor.duplicateNodeName', { name: duplicateName })
              : t(labels, 'auto.t_cc1e0a40')}
          </p>
        )}
        <div
          ref={splitContainerRef}
          className="node-editor-split-container"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {!hideInputPane && (
            <>
              <div className="node-editor-split-pane">
                <InputDataPanel
                  definition={definition}
                  workflowId={workflowId}
                  nodeId={node.id}
                  pinData={pinData}
                  pinBranchData={pinBranchData}
                  nodeDebug={nodeDebug}
                  onExecutePredecessors={onExecutePredecessors}
                />
              </div>
              <div
                className="node-editor-splitter"
                role="separator"
                onMouseDown={startDividerDrag(0)}
              />
            </>
          )}
          <div className="node-editor-split-pane">
            <NodeEditorParamsPane
              definition={definition}
              node={node}
              workflowId={workflowId}
              publicUrl={publicUrl}
              published={published}
              nodeDebug={nodeDebug}
              webhookListenError={webhookListenErrors[node.id]}
              onUpdateNode={onUpdateNode}
              onExecuteNode={onExecuteNode}
              jsonDrafts={jsonDrafts}
              onJsonDraftChange={onJsonDraftChange}
              jsonError={jsonError}
              workflowRunnerPolicy={workflowRunnerPolicy}
              runnerOptions={runnerOptions}
              onReplaceWorkflowDefinition={onReplaceWorkflowDefinition}
              onPatchWorkflowDefinition={onPatchWorkflowDefinition}
            />
          </div>
          <div
            className="node-editor-splitter"
            role="separator"
            onMouseDown={startDividerDrag(1)}
          />
          <div className="node-editor-split-pane">
            <NodeEditorOutputPane
              definition={definition}
              nodeId={node.id}
              nodeDebug={nodeDebug}
              onUpdateNode={onUpdateNode}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
