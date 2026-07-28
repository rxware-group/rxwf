import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowDefinition } from '../../api/client.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import type { NodeDebugState, PinDataMap } from './editor-debug-types.js';
import { DebugOutputPreview } from './DebugOutputPreview.js';
import { DebugErrorPreview } from './DebugErrorPreview.js';
import {
  enrichSatelliteAgentStreamForDisplay,
  formatAgentStreamLine,
  nodeShowsAgentStream,
} from './editor-agent-stream-format.js';
import { isSatelliteNodeType } from './main-flow-predecessors.js';
import {
  formatLogTimestamp,
  listExecutedNodes,
  resolveNodeInputPreview,
  resolveNodeOutputPreview,
} from './editor-log-utils.js';
import type { LogPanelSplit } from './use-editor-layout-prefs.js';
import { useLogPanelSplitter } from './use-log-panel-splitter.js';

const CODE_LOGS_KEY = 'auto.t_a8ce4026';
const AGENT_STREAM_KEY = 'auto.Agent_401f52f3';

type LogVisibility = { input: boolean; output: boolean; codeLogs: boolean; agentStream: boolean };

function statusLabel(labels: LabelMap, status: string): string {
  if (status === 'running') return t(labels, 'editor.running');
  if (status === 'waiting') return t(labels, 'hitl.waitingBadge');
  if (status === 'failed') return t(labels, 'common.failed');
  if (status === 'success') return t(labels, 'editor.success');
  return status;
}

export function EditorLogPanel({
  definition,
  selectedNodeId,
  nodeDebug,
  currentRunId,
  pinData,
  pinBranchData = {},
  collapsed,
  heightPx,
  logSplit,
  onLogSplitChange,
  onToggleCollapsed,
  onSelectNode,
  onClearExecutionData,
}: {
  definition: WorkflowDefinition;
  selectedNodeId: string | null;
  nodeDebug: Record<string, NodeDebugState>;
  currentRunId?: string | null;
  pinData: PinDataMap;
  pinBranchData?: PinBranchDataMap;
  collapsed: boolean;
  heightPx: number;
  logSplit: LogPanelSplit;
  onLogSplitChange: (patch: Partial<LogPanelSplit>) => void;
  onToggleCollapsed: () => void;
  onSelectNode: (id: string) => void;
  onClearExecutionData: () => void;
}) {
  const labels = useLabels();
  const codeLogsLabel = t(labels, CODE_LOGS_KEY);
  const agentStreamLabel = t(labels, AGENT_STREAM_KEY);

  const bodyRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<HTMLDivElement>(null);

  const [visibility, setVisibility] = useState<LogVisibility>({
    input: true,
    output: true,
    codeLogs: true,
    agentStream: true,
  });

  const { startListDrag, startInputOutputDrag, startIoCodeDrag } =
    useLogPanelSplitter(onLogSplitChange);

  const [selectedListKey, setSelectedListKey] = useState<string | null>(null);

  const executedNodes = useMemo(
    () => listExecutedNodes(definition, nodeDebug, currentRunId ?? undefined),
    [definition, nodeDebug, currentRunId],
  );

  const activeListEntry = useMemo(() => {
    if (selectedListKey) {
      const match = executedNodes.find((item) => item.listKey === selectedListKey);
      if (match) return match;
    }
    if (selectedNodeId) {
      return executedNodes.find((item) => item.id === selectedNodeId) ?? executedNodes[0];
    }
    return executedNodes[0];
  }, [executedNodes, selectedListKey, selectedNodeId]);

  const viewNodeId = activeListEntry?.id ?? null;
  const viewIterationRound = activeListEntry?.iterationRound;

  const hasExecutionData = useMemo(() => {
    if (Object.keys(pinData).length > 0) return true;
    return Object.values(nodeDebug).some(
      (d) => d.status && d.status !== 'idle',
    );
  }, [nodeDebug, pinData]);

  useEffect(() => {
    if (selectedNodeId) {
      setSelectedListKey(null);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId && viewNodeId) {
      onSelectNode(viewNodeId);
    }
  }, [selectedNodeId, viewNodeId, onSelectNode]);

  const node = viewNodeId ? definition.nodes.find((n) => n.id === viewNodeId) : null;
  const debug = viewNodeId ? nodeDebug[viewNodeId] : undefined;
  const isCodeNode = node?.type === 'code';
  const isAgentStreamNode = nodeShowsAgentStream(node?.type);
  const inputData = viewNodeId
    ? resolveNodeInputPreview(
        definition,
        viewNodeId,
        pinData,
        nodeDebug,
        viewIterationRound,
        pinBranchData,
      )
    : null;
  const outputData = viewNodeId
    ? resolveNodeOutputPreview(definition, viewNodeId, nodeDebug, viewIterationRound)
    : null;

  const showIo = visibility.input || visibility.output;
  const showIoSplit = visibility.input && visibility.output;
  const showCodeSection = isCodeNode && visibility.codeLogs;
  const showAgentSection = isAgentStreamNode && visibility.agentStream;
  const showBottomSection = showCodeSection || showAgentSection;
  const showIoCodeSplit = showIo && showBottomSection;

  const toggleVisibility = (key: keyof LogVisibility) => {
    setVisibility((v) => ({ ...v, [key]: !v[key] }));
  };

  return (
    <div
      className={`editor-log-panel${collapsed ? ' collapsed' : ''}`}
      style={collapsed ? undefined : { flex: `0 0 ${heightPx}px`, minHeight: 0 }}
    >
      <div className="editor-log-header">
        <div className="editor-log-header-title">
          <span>{t(labels, 'editor.log')}</span>
          {node && <span className="editor-log-node-name">{node.name}</span>}
        </div>
        <div className="editor-log-header-actions">
          <button
            type="button"
            className="editor-log-clear-btn"
            disabled={!hasExecutionData}
            title={t(labels, 'auto.t_e9ebf261')}
            onClick={onClearExecutionData}
          >{t(labels, 'editor.clearExecutionData')}</button>
          {!collapsed && (
            <span className="field-mode-toggle editor-log-visibility-toggle">
              <button
                type="button"
                className={visibility.input ? 'active' : ''}
                onClick={() => toggleVisibility('input')}
              >{t(labels, 'editor.input')}</button>
              <button
                type="button"
                className={visibility.output ? 'active' : ''}
                onClick={() => toggleVisibility('output')}
              >{t(labels, 'editor.output')}</button>
              {isCodeNode && (
                <button
                  type="button"
                  className={visibility.codeLogs ? 'active' : ''}
                  onClick={() => toggleVisibility('codeLogs')}
                >
                  {codeLogsLabel}
                </button>
              )}
              {isAgentStreamNode && (
                <button
                  type="button"
                  className={visibility.agentStream ? 'active' : ''}
                  onClick={() => toggleVisibility('agentStream')}
                >
                  {agentStreamLabel}
                </button>
              )}
            </span>
          )}
          <button
            type="button"
            className="editor-log-collapse-btn"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t(labels, 'auto.t_f1feeff3') : t(labels, 'auto.t_d50c9800')}
            onClick={onToggleCollapsed}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="editor-log-body" ref={bodyRef}>
          <aside
            className="editor-log-node-list"
            style={{ width: `${logSplit.listPct}%` }}
          >
            {executedNodes.length === 0 ? (
              <p className="hint">{t(labels, 'editor.noExecutedNodes')}</p>
            ) : (
              <ul className="editor-log-node-list-items">
                {executedNodes.map((item) => (
                  <li key={item.listKey}>
                    <button
                      type="button"
                      className={`editor-log-node-item${activeListEntry?.listKey === item.listKey ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedListKey(item.listKey);
                        onSelectNode(item.id);
                      }}
                    >
                      <span className="editor-log-node-item-name">{item.name}</span>
                      <span className="editor-log-node-item-meta">
                        <span className={`editor-log-node-item-status status-${item.status}`}>
                          {item.status === 'running' ? (
                            <LoadingSpinner size="sm" label={t(labels, 'editor.running')} />
                          ) : (
                            statusLabel(labels, item.status)
                          )}
                        </span>
                        {item.durationMs !== undefined && (
                          <span className="editor-log-node-item-duration">
                            {item.durationMs} ms
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <div
            className="editor-log-splitter editor-log-splitter--col"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(e) => startListDrag(e, bodyRef.current)}
          />
          <div className="editor-log-detail" ref={detailRef}>
            {executedNodes.length === 0 ? (
              <p className="hint">{t(labels, 'editor.logHintExecute')}</p>
            ) : !viewNodeId ? (
              <p className="hint">{t(labels, 'editor.logHintSelect')}</p>
            ) : (
              <>
                {showIo && (
                  <div
                    className="editor-log-detail-upper"
                    style={
                      showIoCodeSplit
                        ? { height: `${logSplit.ioTopPct}%` }
                        : { flex: 1 }
                    }
                  >
                    <div className="editor-log-io-row" ref={ioRef}>
                      {visibility.input && (
                        <section
                          className="editor-log-io-pane"
                          style={
                            showIoSplit
                              ? { width: `${logSplit.inputPct}%` }
                              : { flex: 1 }
                          }
                        >
                          <h4 className="editor-log-section-title">{t(labels, 'auto.t_e8850440')}</h4>
                          <div className="debug-data-box editor-log-pane-content">
                            {inputData === null ? (
                              <p className="hint">{t(labels, 'editor.noInputData')}</p>
                            ) : (
                              <pre>{JSON.stringify(inputData, null, 2)}</pre>
                            )}
                          </div>
                        </section>
                      )}
                      {showIoSplit && (
                        <div
                          className="editor-log-splitter editor-log-splitter--col"
                          role="separator"
                          aria-orientation="vertical"
                          onMouseDown={(e) => startInputOutputDrag(e, ioRef.current)}
                        />
                      )}
                      {visibility.output && (
                        <section className="editor-log-io-pane" style={{ flex: 1 }}>
                          <h4 className="editor-log-section-title">{t(labels, 'auto.t_ded698ae')}</h4>
                          {outputData?.kind === 'branches' && debug?.status !== 'failed' ? (
                            <div className="editor-log-pane-content">
                              {outputData === null ? (
                                <p className="hint">{t(labels, 'editor.noOutputYet')}</p>
                              ) : (
                                <DebugOutputPreview preview={outputData} />
                              )}
                            </div>
                          ) : (
                            <div className="debug-data-box editor-log-pane-content">
                              {debug?.status === 'failed' ? (
                                <DebugErrorPreview debug={debug} />
                              ) : outputData === null ? (
                                <p className="hint">{t(labels, 'editor.noOutputYet')}</p>
                              ) : (
                                <DebugOutputPreview preview={outputData} />
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                  </div>
                )}
                {showIoCodeSplit && (
                  <div
                    className="editor-log-splitter editor-log-splitter--row"
                    role="separator"
                    aria-orientation="horizontal"
                    onMouseDown={(e) => startIoCodeDrag(e, detailRef.current)}
                  />
                )}
                {showCodeSection && (
                  <section className="editor-log-code-section">
                    <h4 className="editor-log-section-title">{codeLogsLabel}</h4>
                    <div className="debug-data-box editor-log-pane-content">
                      {!debug?.logs?.length ? (
                        <p className="hint">{t(labels, 'editor.noRunLog')}</p>
                      ) : (
                        <ul className="editor-log-list">
                          {debug.logs.map((entry, i) => (
                            <li key={i} className={`log-${entry.level}`}>
                              <span className="log-ts">{formatLogTimestamp(entry.timestamp)}</span>{' '}
                              <span className="log-level">[{entry.level}]</span>{' '}
                              {entry.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                )}
                {showAgentSection && (
                  <section className="editor-log-code-section">
                    <h4 className="editor-log-section-title">{agentStreamLabel}</h4>
                    <div className="debug-data-box editor-log-pane-content">
                      {!debug?.agentStream?.length ? (
                        <p className="hint">{t(labels, 'editor.noAgentStream')}</p>
                      ) : (
                        <ol className="editor-log-list editor-agent-stream-list">
                          {(isSatelliteNodeType(node?.type ?? '')
                            ? enrichSatelliteAgentStreamForDisplay(debug.agentStream, debug)
                            : debug.agentStream
                          ).map((entry, i) => {
                            const { label, detail } = formatAgentStreamLine(labels, entry, {
                              nodeType: node?.type,
                              nodeName: node?.name,
                            });
                            return (
                              <li key={i} className={`editor-agent-stream-${entry.type}`}>
                                <span className="editor-agent-stream-label">{label}</span>
                                {detail && (
                                  <pre className="editor-agent-stream-detail">{detail}</pre>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  </section>
                )}
                {!showIo && !showBottomSection && (
                  <p className="hint">{t(labels, 'editor.log.selectTab')}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
