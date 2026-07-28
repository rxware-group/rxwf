import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUnsavedNavigationGuard } from '../../hooks/use-unsaved-navigation-guard.js';
import { api, type WorkflowAccessRole, type WorkflowDefinition } from '../../api/client.js';
import { EditorCanvasHeader } from './EditorCanvasHeader.js';
import { PublishHistoryModal } from './PublishHistoryModal.js';
import { WorkflowSettingsModal } from './WorkflowSettingsModal.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { NodePalette } from './NodePalette.js';
import { WorkflowCanvas } from './WorkflowCanvas.js';
import { EditorLogPanel } from './EditorLogPanel.js';
import { NodeEditorModal } from './NodeEditorModal.js';
import { useEditorLayoutPrefs, clampPaletteWidth, clampChatWidth, clampLogHeight } from './use-editor-layout-prefs.js';
import { defaultNodeParameters } from './node-port-defs.js';
import { validateConnections } from './validate-connections.js';
import {
  defaultRunnerPolicy,
  parseRunnerPolicy,
  applyRunnerPolicyToSettings,
  type RunnerPolicy,
} from '../runners/runner-policy-types.js';
import type { RunnerOption } from '../runners/RunnerCompactEditor.js';
import type {
  NodeDebugState,
  PinDataMap,
} from './editor-debug-types.js';
import { applyPinFromResultsToMaps } from './apply-pin-from-results.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import {
  applyAgentOrSatelliteStream,
  applyNodeDebugResults,
  finalizeFailedRunNodes,
  markDebugNodeStarted,
  markPartialRunStarted,
  markDebugNodeWaiting,
  snapshotNodeDebug,
  clearSatelliteDebugForHubRun,
  syncHubSatellitesOnAgentFailure,
  buildHubAgentSyncPayloadFromOutputItems,
  syncHubSatellitesOnAgentSuccess,
} from './node-debug-run-state.js';
import { pruneEmptyBranchDownstream } from './prune-empty-branch-downstream.js';
import {
  buildPinForPartialRun,
  listPartialRunNodeIds,
} from './build-pin-for-partial-run.js';
import { runWebhookListenDebug } from './run-webhook-listen.js';
import {
  isWebhookAuthErrorCode,
  type WebhookListenError,
} from './webhook-listen-error.js';
import {
  applyAllJsonDraftsToDefinition,
  applyJsonDraftsToDefinition,
  initJsonDraftsForNode,
  resolveJsonDraftsForNode,
} from './editor-json-params.js';
import { getNodeMeta } from './node-type-meta.js';
import { ensureUniqueNodeName } from './unique-node-name.js';
import { PublishDialog } from './PublishDialog.js';
import { normalizeWorkflowDefinition } from '@rxwf/workflow/normalize';
import { useWorkflowAutoSave } from './use-workflow-auto-save.js';
import {
  useDebouncedCommit,
  useDeleteSelectedNodeShortcut,
  useEditorUndoRedoShortcuts,
  useWorkflowHistory,
} from './use-workflow-history.js';
import {
  nodePositionAtViewportCenter,
  type FlowPositionGetter,
} from './flow-viewport-center.js';
import { snapPointToGrid } from './canvas-grid.js';
import { EditorChatSidebar } from './EditorChatSidebar.js';
import { WorkflowExecutionsSidebar } from './WorkflowExecutionsSidebar.js';
import { EditorLeftPane } from './EditorLeftPane.js';
import { executionToDebugState } from '../executions/execution-to-debug-state.js';
import { useExecutionPoll } from '../executions/use-execution-poll.js';
import { HitlApprovalBanner } from '../executions/HitlApprovalBanner.js';
import type { ExecutionDetail } from '../../api/client.js';
import { listMainDownstreamNodeIds } from './list-main-downstream-node-ids.js';
import {
  findMainFlowTriggerOnPath,
  getMainFlowPredecessorsRunTarget,
} from './main-flow-predecessors.js';
import { isCrewEditorEnabled } from './crew-editor-settings.js';

const emptyDef = (): WorkflowDefinition => ({
  schemaVersion: 1,
  name: 'New',
  nodes: [
    {
      id: 'n-start',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 120, y: 160 },
      parameters: defaultNodeParameters('manualTrigger'),
    },
  ],
  connections: [],
});

export function WorkflowEditorPage() {
  const labels = useLabels();

  const { workflowId, executionId } = useParams<{ workflowId: string; executionId?: string }>();
  const location = useLocation();
  const isExecutionsTab = location.pathname.includes('/executions');
  const basePath = workflowId ? `/workflows/${workflowId}` : '/workflows/new';
  const isNewWorkflow = !workflowId || workflowId === 'new';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const definitionRef = useRef<WorkflowDefinition>(emptyDef());
  const syncAfterHistory = useCallback(() => {
    const def = definitionRef.current;
    setSelectedNodeId((sel) => {
      if (!sel) return sel;
      const node = def.nodes.find((n) => n.id === sel);
      if (!node) return null;
      setJsonDraftsByNode((prev) => ({
        ...prev,
        [sel]: initJsonDraftsForNode(node),
      }));
      return sel;
    });
  }, []);

  const {
    definition,
    commitDefinition,
    patchDefinition,
    commitDebouncedSnapshot,
    replaceDefinition,
    undo,
    redo,
  } = useWorkflowHistory(emptyDef(), syncAfterHistory);

  definitionRef.current = definition;

  const { debouncedCommit, flushPending } = useDebouncedCommit(
    patchDefinition,
    commitDebouncedSnapshot,
    () => definitionRef.current,
  );

  const [publishStatus, setPublishStatus] = useState<'draft' | 'published'>('draft');
  const [publishedSemver, setPublishedSemver] = useState<string | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPublishHistory, setShowPublishHistory] = useState(false);
  const [publicUrl, setPublicUrl] = useState('http://localhost:8787');
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [exposeAsTool, setExposeAsTool] = useState(false);
  const [exposeAsToolDescription, setExposeAsToolDescription] = useState('');
  const [accessRole, setAccessRole] = useState<WorkflowAccessRole | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [runnerPolicy, setRunnerPolicy] = useState<RunnerPolicy>(defaultRunnerPolicy());
  const [runnerOptions, setRunnerOptions] = useState<RunnerOption[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDebug, setNodeDebug] = useState<Record<string, NodeDebugState>>({});
  const [pinData, setPinData] = useState<PinDataMap>({});
  const [pinBranchData, setPinBranchData] = useState<PinBranchDataMap>({});
  const pinMapsRef = useRef({ pinData, pinBranchData });
  pinMapsRef.current = { pinData, pinBranchData };
  const [jsonDraftsByNode, setJsonDraftsByNode] = useState<
    Record<string, Record<string, string>>
  >({});
  const jsonDraftsByNodeRef = useRef(jsonDraftsByNode);
  jsonDraftsByNodeRef.current = jsonDraftsByNode;
  const jsonFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jsonParamError, setJsonParamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !isNewWorkflow);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const { prefs: layoutPrefs, update: updateLayoutPrefs } = useEditorLayoutPrefs();
  const editorGridRef = useRef<HTMLDivElement>(null);
  const editorMainRef = useRef<HTMLDivElement>(null);
  const editorWorkspaceRef = useRef<HTMLDivElement>(null);
  const flowCenterRef = useRef<FlowPositionGetter>(() => ({ x: 200, y: 200 }));
  const [replayDefinition, setReplayDefinition] = useState<WorkflowDefinition | null>(null);
  const [replayNodeDebug, setReplayNodeDebug] = useState<Record<string, NodeDebugState>>({});
  const [replayPinData, setReplayPinData] = useState<PinDataMap>({});
  const [replayFailedNodeId, setReplayFailedNodeId] = useState<string | null>(null);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [replayDetail, setReplayDetail] = useState<ExecutionDetail | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [executionsRefreshKey, setExecutionsRefreshKey] = useState(0);
  const currentDebugRunRef = useRef<string | null>(null);
  const webhookListenRef = useRef<{ nodeId: string; listenId: string } | null>(null);
  const [webhookListenErrors, setWebhookListenErrors] = useState<
    Record<string, WebhookListenError | undefined>
  >({});
  const nodeRunOrderRef = useRef(new Map<string, number>());
  const nextRunSeqRef = useRef(1);
  const ensureRunSeq = useCallback((nodeId: string): number => {
    const existing = nodeRunOrderRef.current.get(nodeId);
    if (existing != null) return existing;
    const seq = nextRunSeqRef.current++;
    nodeRunOrderRef.current.set(nodeId, seq);
    return seq;
  }, []);
  const clearRunOrderForNodes = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    for (const id of nodeIds) {
      nodeRunOrderRef.current.delete(id);
    }
  }, []);
  const resetRunOrder = useCallback(() => {
    nodeRunOrderRef.current.clear();
    nextRunSeqRef.current = 1;
  }, []);
  const registerFlowCenter = useCallback((getter: FlowPositionGetter) => {
    flowCenterRef.current = getter;
  }, []);

  useEffect(() => {
    if (loading || layoutPrefs.logCollapsed) return;
    const workspaceH = editorWorkspaceRef.current?.getBoundingClientRect().height;
    if (!workspaceH) return;
    const clamped = clampLogHeight(layoutPrefs.logHeightPx, workspaceH);
    if (clamped !== layoutPrefs.logHeightPx) {
      updateLayoutPrefs({ logHeightPx: clamped });
    }
    // Re-sync once when editor layout becomes visible
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logHeightPx intentionally omitted
  }, [loading, layoutPrefs.logCollapsed, updateLayoutPrefs]);

  useEffect(() => {
    if (layoutPrefs.logCollapsed) return;
    const onResize = () => {
      const workspaceH = editorWorkspaceRef.current?.getBoundingClientRect().height;
      if (!workspaceH) return;
      updateLayoutPrefs({
        logHeightPx: clampLogHeight(layoutPrefs.logHeightPx, workspaceH),
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layoutPrefs.logCollapsed, layoutPrefs.logHeightPx, updateLayoutPrefs]);

  const refreshRunnerOptions = useCallback(() => {
    api.runners.list().then(setRunnerOptions).catch(() => setRunnerOptions([]));
  }, []);

  useEffect(() => {
    refreshRunnerOptions();
    api.features().then((f) => {
      setPublicUrl(f.publicUrl);
    });
  }, [refreshRunnerOptions]);

  useEffect(() => {
    if (showSettings || selectedNodeId) {
      refreshRunnerOptions();
    }
  }, [showSettings, selectedNodeId, refreshRunnerOptions]);

  useEffect(() => {
    if (isNewWorkflow) {
      setLoading(false);
      setError(null);
      setAccessRole(null);
      return;
    }
    setLoading(true);
    setError(null);
    api.workflows
      .get(workflowId)
      .then((w) => {
        const def = w.definition;
        if (!def?.nodes || !Array.isArray(def.connections)) {
          throw new Error(t(labels, 'auto.t_063b9ff2'));
        }
        replaceDefinition(
          normalizeWorkflowDefinition({
            ...def,
            nodes: def.nodes.map((n, i) => ({
              ...n,
              position: n.position ?? { x: 120 + i * 240, y: 120 },
            })),
          }),
        );
        setPublishStatus(w.status === 'published' ? 'published' : 'draft');
        setPublishedSemver(w.publishedSemverLabel ?? null);
        setHasUnpublishedChanges(Boolean(w.hasUnpublishedChanges));
        setRunnerPolicy(parseRunnerPolicy(def.settings));
        setExposeAsTool(Boolean(def.settings?.exposeAsTool));
        setExposeAsToolDescription(
          String(def.settings?.exposeAsToolDescription ?? ''),
        );
        setAccessRole(w.accessRole ?? null);
        currentDebugRunRef.current = null;
        resetRunOrder();
        setNodeDebug({});
        setPinData({});
        setDirty(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t(labels, 'auto.t_33e87c7b'));
      })
      .finally(() => setLoading(false));
  }, [workflowId, replaceDefinition, resetRunOrder]);

  useEffect(() => {
    const debugExecutionId = searchParams.get('debugExecution');
    if (!debugExecutionId || !workflowId || isNewWorkflow) return;
    void api.executions.getDebugPinData(debugExecutionId).then((data) => {
      setPinData(data.pinData);
      if (data.failedNodeId) setSelectedNodeId(data.failedNodeId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('debugExecution');
        return next;
      });
    }).catch(() => undefined);
  }, [searchParams, setSearchParams, workflowId, isNewWorkflow]);

  const applyExecutionDetail = useCallback((detail: ExecutionDetail) => {
    const mapped = executionToDebugState(detail);
    setReplayDefinition(mapped.definition);
    setReplayNodeDebug(mapped.nodeDebug);
    setReplayPinData(mapped.pinData);
    setReplayFailedNodeId(mapped.failedNodeId ?? null);
    setReplayStatus(detail.status);
    setReplayDetail(detail);
    const firstExecuted = detail.nodeRuns[0]?.nodeId ?? null;
    setSelectedNodeId(mapped.failedNodeId ?? firstExecuted);
  }, []);

  const polledDetail = useExecutionPoll(
    executionId,
    isExecutionsTab && (replayStatus === 'running' || replayStatus === 'waiting'),
  );

  useEffect(() => {
    if (!polledDetail) return;
    applyExecutionDetail(polledDetail);
  }, [polledDetail, applyExecutionDetail]);

  useEffect(() => {
    if (!isExecutionsTab || !workflowId || isNewWorkflow) {
      setReplayDefinition(null);
      setReplayNodeDebug({});
      setReplayPinData({});
      setReplayFailedNodeId(null);
      setReplayStatus(null);
      setReplayError(null);
      return;
    }
    if (executionId) {
      setReplayLoading(true);
      setReplayError(null);
      void api.executions
        .get(executionId)
        .then(applyExecutionDetail)
        .catch((e) => {
          setReplayError(
            e instanceof Error ? e.message : t(labels, 'common.loadFailed'),
          );
        })
        .finally(() => setReplayLoading(false));
      return;
    }
    void api.executions.list(workflowId).then((res) => {
      const latest = res.items[0];
      if (latest) {
        navigate(`${basePath}/executions/${latest.id}`, { replace: true });
      }
    });
  }, [
    isExecutionsTab,
    workflowId,
    isNewWorkflow,
    executionId,
    basePath,
    navigate,
    applyExecutionDetail,
    labels,
  ]);

  /** Detect external webhook / production runs while editing. */
  useEffect(() => {
    if (!workflowId || isNewWorkflow) return;
    let cancelled = false;
    let knownTopId = '';
    const poll = async () => {
      try {
        const res = await api.executions.list(workflowId);
        if (cancelled) return;
        const topId = res.items[0]?.id ?? '';
        if (topId && knownTopId && topId !== knownTopId) {
          setExecutionsRefreshKey((k) => k + 1);
        }
        if (topId) knownTopId = topId;
      } catch {
        /* ignore poll errors */
      }
    };
    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workflowId, isNewWorkflow]);

  const handleCopyToEditor = useCallback(() => {
    setNodeDebug({ ...replayNodeDebug });
    setPinData({ ...replayPinData });
    if (replayFailedNodeId) setSelectedNodeId(replayFailedNodeId);
    navigate(basePath);
  }, [replayNodeDebug, replayPinData, replayFailedNodeId, basePath, navigate]);

  const canvasDefinition =
    isExecutionsTab && replayDefinition ? replayDefinition : definition;
  const canvasNodeDebug = isExecutionsTab ? replayNodeDebug : nodeDebug;
  const canvasPinData = isExecutionsTab ? replayPinData : pinData;
  const canvasPinBranchData = isExecutionsTab ? {} : pinBranchData;

  const handleUndo = useCallback(() => {
    flushPending();
    undo();
  }, [flushPending, undo]);

  const handleRedo = useCallback(() => {
    flushPending();
    redo();
  }, [flushPending, redo]);

  useEditorUndoRedoShortcuts(handleUndo, handleRedo, true);

  useEffect(() => {
    if (!selectedNodeId) return;
    const node = definition.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    setJsonDraftsByNode((prev) => {
      if (prev[selectedNodeId]) return prev;
      return { ...prev, [selectedNodeId]: initJsonDraftsForNode(node) };
    });
  }, [selectedNodeId, definition]);

  const enableCrew = isCrewEditorEnabled(definition.settings);

  const flushJsonDraftsForNode = useCallback(
    (nodeId: string, options?: { reportError?: boolean }): boolean => {
      const node = definitionRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return true;
      const drafts = resolveJsonDraftsForNode(
        node,
        jsonDraftsByNodeRef.current[nodeId] ?? {},
      );
      const applied = applyJsonDraftsToDefinition(
        labels,
        definitionRef.current,
        nodeId,
        drafts,
      );
      if (applied.error) {
        if (options?.reportError !== false) {
          setJsonParamError(applied.error);
        }
        return false;
      }
      commitDefinition(() => applied.definition);
      setDirty(true);
      setJsonParamError(null);
      return true;
    },
    [labels, commitDefinition],
  );

  const scheduleJsonDraftFlush = useCallback(
    (nodeId: string) => {
      if (jsonFlushTimerRef.current) clearTimeout(jsonFlushTimerRef.current);
      jsonFlushTimerRef.current = setTimeout(() => {
        jsonFlushTimerRef.current = null;
        flushJsonDraftsForNode(nodeId, { reportError: false });
      }, 450);
    },
    [flushJsonDraftsForNode],
  );

  const buildDefinitionForRun = useCallback((base?: WorkflowDefinition) => {
    const merged = applyAllJsonDraftsToDefinition(
      labels,
      base ?? definition,
      jsonDraftsByNode,
    );
    const d = merged.error ? (base ?? definition) : merged.definition;
    return {
      ...d,
      settings: {
        ...applyRunnerPolicyToSettings(d.settings, runnerPolicy),
        exposeAsTool: exposeAsTool || undefined,
        exposeAsToolDescription: exposeAsToolDescription.trim() || undefined,
      },
    };
  }, [definition, jsonDraftsByNode, labels, runnerPolicy, exposeAsTool, exposeAsToolDescription]);

  const refreshWorkflowMeta = useCallback(async () => {
    if (!workflowId || isNewWorkflow) return;
    const w = await api.workflows.get(workflowId);
    setPublishStatus(w.status === 'published' ? 'published' : 'draft');
    setPublishedSemver(w.publishedSemverLabel ?? null);
    setHasUnpublishedChanges(Boolean(w.hasUnpublishedChanges));
  }, [workflowId, isNewWorkflow]);

  const { autoSaveStatus, flushAutoSave } = useWorkflowAutoSave({
    workflowId,
    isNewWorkflow,
    dirty,
    definition,
    buildDefinitionForRun,
    validateConnections,
    onCreate: async (defWithPolicy) => {
      const created = await api.workflows.create(definition.name, defWithPolicy);
      navigate(`/workflows/${created.id}`);
    },
    onSaved: () => {
      setDirty(false);
      setError(null);
      void refreshWorkflowMeta();
    },
    onError: (message) => setError(message),
  });

  const confirmLeave = useCallback(async () => {
    if (dirty || autoSaveStatus === 'saving') {
      const saved = await flushAutoSave();
      if (saved) return true;
      return confirm({
        title: t(labels, 'auto.t_3764741a'),
        message: t(labels, 'auto.t_54765fb4'),
        confirmLabel: t(labels, 'auto.t_0ba18905'),
        danger: true,
      });
    }
    return true;
  }, [autoSaveStatus, confirm, dirty, flushAutoSave, labels]);

  useUnsavedNavigationGuard(dirty || autoSaveStatus === 'saving', confirmLeave);

  useEffect(() => {
    if (!dirty && autoSaveStatus !== 'saving') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, autoSaveStatus]);

  useEffect(() => {
    return () => {
      if (jsonFlushTimerRef.current) {
        clearTimeout(jsonFlushTimerRef.current);
        jsonFlushTimerRef.current = null;
      }
    };
  }, []);

  const executeNode = useCallback(
    async (nodeId: string, options?: { selectOnCanvas?: boolean }) => {
      setError(null);
      setJsonParamError(null);
      if (options?.selectOnCanvas !== false) {
        setSelectedNodeId(nodeId);
      }
      let runNodeIds: string[] = [];
      let priorRunDebug: Record<string, NodeDebugState | undefined> = {};
      try {
        const debugRunId = crypto.randomUUID();
        currentDebugRunRef.current = debugRunId;
        const base = buildDefinitionForRun();
        const targetNode = base.nodes.find((n) => n.id === nodeId);
        if (!targetNode) throw new Error(t(labels, 'auto.t_881d7569'));

        if (!findMainFlowTriggerOnPath(base, nodeId)) {
          throw new Error(t(labels, 'editor.requiresTriggerNode'));
        }

        if (
          targetNode.type === 'webhookTrigger' &&
          nodeDebug[nodeId]?.status === 'waiting' &&
          webhookListenRef.current?.nodeId === nodeId &&
          workflowId &&
          !isNewWorkflow
        ) {
          await api.workflows.cancelWebhookListen(
            workflowId,
            webhookListenRef.current.listenId,
          );
          webhookListenRef.current = null;
          currentDebugRunRef.current = null;
          setWebhookListenErrors((prev) => ({ ...prev, [nodeId]: undefined }));
          setNodeDebug((prev) => {
            const next = { ...prev };
            delete next[nodeId];
            return next;
          });
          return;
        }

        const pinForRun = buildPinForPartialRun(
          base,
          nodeId,
          pinData,
          nodeDebug,
          pinBranchData,
        );
        runNodeIds = listPartialRunNodeIds(base, nodeId, pinForRun);
        priorRunDebug = snapshotNodeDebug(nodeDebug, runNodeIds);
        let debugForRun = { ...nodeDebug };
        let pinForPrune = { ...pinData };
        let pinBranchForPrune = { ...pinBranchData };
        const downstreamNodeIds = listMainDownstreamNodeIds(base, nodeId);
        if (downstreamNodeIds.length > 0) {
          clearRunOrderForNodes(downstreamNodeIds);
          for (const downstreamId of downstreamNodeIds) {
            delete debugForRun[downstreamId];
            delete pinForPrune[downstreamId];
            delete pinBranchForPrune[downstreamId];
          }
          pinMapsRef.current = {
            pinData: pinForPrune,
            pinBranchData: pinBranchForPrune,
          };
          setNodeDebug(debugForRun);
          setPinData(pinForPrune);
          setPinBranchData(pinBranchForPrune);
        }
        for (const runId of runNodeIds) {
          const branches = debugForRun[runId]?.outputItems;
          if (branches?.length) {
            const pruned = pruneEmptyBranchDownstream(
              base,
              runId,
              branches,
              debugForRun,
              pinForPrune,
              pinBranchForPrune,
            );
            debugForRun = pruned.nodeDebug;
            pinForPrune = pruned.pinData;
            pinBranchForPrune = pruned.pinBranchData;
          }
        }
        setPinData(pinForPrune);
        setPinBranchData(pinBranchForPrune);
        const targetRunSeq = ensureRunSeq(nodeId);
        const clearedDebug = clearSatelliteDebugForHubRun(debugForRun, base, nodeId);
        const runMeta = { runId: debugRunId, runSeq: targetRunSeq };
        setNodeDebug(
          targetNode.type === 'webhookTrigger'
            ? markDebugNodeWaiting(clearedDebug, nodeId, runMeta)
            : markPartialRunStarted(clearedDebug, nodeId, runMeta),
        );

        let flushed = base;
        for (const runId of runNodeIds) {
          const n = flushed.nodes.find((x) => x.id === runId);
          if (!n) continue;
          const drafts = resolveJsonDraftsForNode(
            n,
            jsonDraftsByNode[runId] ?? {},
          );
          const applied = applyJsonDraftsToDefinition(labels, flushed, runId, drafts);
          if (applied.error) {
            setJsonParamError(applied.error);
            throw new Error(applied.error);
          }
          flushed = applied.definition as typeof base;
        }
        const runDef = {
          ...flushed,
          settings: applyRunnerPolicyToSettings(flushed.settings, runnerPolicy),
        };
        const localErrors = validateConnections(runDef);
        if (localErrors.length > 0) {
          throw new Error(localErrors.join('; '));
        }

        const streamHandlers = {
          onNodeStarted: (startedNodeId: string) => {
            if (currentDebugRunRef.current !== debugRunId) return;
            const runSeq = ensureRunSeq(startedNodeId);
            setNodeDebug((prev) =>
              markDebugNodeStarted(prev, startedNodeId, {
                runId: debugRunId,
                runSeq,
              }),
            );
          },
          onAgentStream: (streamNodeId: string, chunk: unknown) => {
            if (currentDebugRunRef.current !== debugRunId) return;
            const runSeq = ensureRunSeq(streamNodeId);
            setNodeDebug((prev) =>
              applyAgentOrSatelliteStream(
                prev,
                streamNodeId,
                chunk as Parameters<typeof applyAgentOrSatelliteStream>[2],
                {
                  runId: debugRunId,
                  runSeq,
                },
              ),
            );
          },
          onNodeResult: (
            completedNodeId: string,
            nodeResult: Parameters<typeof applyNodeDebugResults>[1][string] & {
              status: 'success' | 'failed' | 'skipped' | 'waiting';
            },
          ) => {
            if (currentDebugRunRef.current !== debugRunId) return;
            const observedRunSeq = ensureRunSeq(completedNodeId);
            const { pinData: curPin, pinBranchData: curBranch } = pinMapsRef.current;
            setNodeDebug((prev) => {
              let next = applyNodeDebugResults(prev, {
                [completedNodeId]: {
                  ...nodeResult,
                  runId: debugRunId,
                  runSeq: observedRunSeq,
                },
              });
              if (nodeResult.status === 'failed') {
                next = syncHubSatellitesOnAgentFailure(
                  next,
                  runDef,
                  completedNodeId,
                  nodeResult.errorMessage,
                  { runId: debugRunId, runSeq: observedRunSeq },
                );
              }
              if (nodeResult.status === 'success') {
                next = syncHubSatellitesOnAgentSuccess(
                  next,
                  runDef,
                  completedNodeId,
                  buildHubAgentSyncPayloadFromOutputItems(nodeResult.outputItems),
                  { runId: debugRunId, runSeq: observedRunSeq },
                );
              }
              if (
                nodeResult.status === 'success' &&
                nodeResult.outputItems?.length
              ) {
                next = pruneEmptyBranchDownstream(
                  runDef,
                  completedNodeId,
                  nodeResult.outputItems,
                  next,
                  curPin,
                  curBranch,
                ).nodeDebug;
              }
              return next;
            });
            const applied = applyPinFromResultsToMaps(runDef, curPin, curBranch, {
              [completedNodeId]: nodeResult,
            });
            if (
              nodeResult.status === 'success' &&
              nodeResult.outputItems?.length
            ) {
              const pruned = pruneEmptyBranchDownstream(
                runDef,
                completedNodeId,
                nodeResult.outputItems,
                nodeDebug,
                applied.pinData,
                applied.pinBranchData,
              );
              setPinData(pruned.pinData);
              setPinBranchData(pruned.pinBranchData);
            } else {
              setPinData(applied.pinData);
              setPinBranchData(applied.pinBranchData);
            }
          },
        };

        if (targetNode.type === 'webhookTrigger') {
          if (!workflowId || isNewWorkflow) {
            throw new Error(t(labels, 'webhook.listenRequiresSave'));
          }
          const webhookPath = String(targetNode.parameters.path ?? 'hook');
          setWebhookListenErrors((prev) => ({ ...prev, [nodeId]: undefined }));
          const listenResult = await runWebhookListenDebug({
            workflowId,
            webhookNodeId: nodeId,
            targetNodeId: nodeId,
            webhookPath,
            definition: runDef,
            pinData: pinForRun.pinData,
            pinBranchData: pinForRun.pinBranchData,
            handlers: {
              ...streamHandlers,
              onListenStarted: (listenId) => {
                webhookListenRef.current = { nodeId, listenId };
              },
              onListenError: (error) => {
                if (currentDebugRunRef.current !== debugRunId) return;
                setWebhookListenErrors((prev) => ({ ...prev, [nodeId]: error }));
                setNodeDebug((prev) => {
                  const next = { ...prev };
                  delete next[nodeId];
                  return next;
                });
              },
              onNodeResult: (...args) => {
                streamHandlers.onNodeResult?.(...args);
                setExecutionsRefreshKey((k) => k + 1);
              },
              isCancelled: () => currentDebugRunRef.current !== debugRunId,
            },
          });
          webhookListenRef.current = null;
          if (listenResult.status === 'cancelled') {
            setNodeDebug((prev) => {
              const next = { ...prev };
              delete next[nodeId];
              return next;
            });
            return;
          }
          if (listenResult.status === 'expired') {
            setNodeDebug((prev) => {
              const next = { ...prev };
              delete next[nodeId];
              return next;
            });
            setWebhookListenErrors((prev) => ({
              ...prev,
              [nodeId]: {
                code: listenResult.errorCode,
                message: listenResult.errorMessage ?? t(labels, 'webhook.listenExpired'),
              },
            }));
            return;
          }
          if (listenResult.status === 'failed') {
            if (listenResult.errorCode || listenResult.errorMessage) {
              setWebhookListenErrors((prev) => ({
                ...prev,
                [nodeId]: {
                  code: listenResult.errorCode,
                  message: listenResult.errorMessage ?? t(labels, 'auto.t_a8749d75'),
                },
              }));
              setNodeDebug((prev) => {
                const next = { ...prev };
                delete next[nodeId];
                return next;
              });
            }
            if (!isWebhookAuthErrorCode(listenResult.errorCode)) {
              const failedNode = base.nodes.find((n) => n.id === listenResult.failedNodeId);
              setError(
                failedNode
                  ? t(labels, 'toast.nodeExecFailed', { name: failedNode.name })
                  : listenResult.errorMessage ?? t(labels, 'auto.t_a8749d75'),
              );
            }
          }
          if (listenResult.executionId) {
            setExecutionsRefreshKey((k) => k + 1);
          }
          return;
        }

        const result = await api.workflows.debugNodeStream(
          runDef,
          nodeId,
          pinForRun.pinData,
          {
            workflowId: workflowId && !isNewWorkflow ? workflowId : undefined,
            environment: 'test',
            pinBranchData: pinForRun.pinBranchData,
            ...streamHandlers,
          },
        );
        if (result.status === 'failed') {
          const failedNode = base.nodes.find((n) => n.id === result.failedNodeId);
          setError(
            failedNode
              ? t(labels, 'toast.nodeExecFailed', { name: failedNode.name })
              : result.failedNodeId
                ? t(labels, 'toast.nodeExecFailed', { name: result.failedNodeId })
                : t(labels, 'auto.t_a8749d75'),
          );
        }
        if (result.executionId) {
          setExecutionsRefreshKey((k) => k + 1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t(labels, 'auto.t_9746cfc7');
        setNodeDebug((d) =>
          finalizeFailedRunNodes(d, runNodeIds, nodeId, priorRunDebug, msg),
        );
        setError(msg);
      }
    },
    [
      buildDefinitionForRun,
      pinData,
      pinBranchData,
      nodeDebug,
      jsonDraftsByNode,
      runnerPolicy,
      labels,
      ensureRunSeq,
      clearRunOrderForNodes,
      workflowId,
      isNewWorkflow,
    ],
  );

  const executePredecessors = useCallback(
    async (editorNodeId: string) => {
      setError(null);
      const base = buildDefinitionForRun();
      if (!findMainFlowTriggerOnPath(base, editorNodeId)) {
        setError(t(labels, 'editor.requiresTriggerNode'));
        return;
      }
      const targetId = getMainFlowPredecessorsRunTarget(base, editorNodeId);
      if (!targetId) return;
      await executeNode(targetId, { selectOnCanvas: false });
    },
    [buildDefinitionForRun, executeNode, labels],
  );

  const addNode = (type: string) => {
    const id = `n-${crypto.randomUUID().slice(0, 8)}`;
    const meta = getNodeMeta(type);
    const uniqueName = ensureUniqueNodeName(
      definition.nodes.map((n) => n.name),
      meta.label,
    );
    const center = flowCenterRef.current();
    const offset =
      type === 'aiAgent' ? { x: 120, y: 44 } : { x: 48, y: 48 };
    const modelId = type === 'skillRun' ? `n-${crypto.randomUUID().slice(0, 8)}` : null;
    const modelMeta = modelId ? getNodeMeta('aiChatModel') : null;
    const modelName =
      modelId && modelMeta
        ? ensureUniqueNodeName(
            [...definition.nodes.map((n) => n.name), uniqueName],
            modelMeta.label,
          )
        : null;
    commitDefinition((d) => {
      const position = nodePositionAtViewportCenter(
        center,
        d.nodes.length,
        offset,
      );
      const nextNodes: WorkflowDefinition['nodes'] = [...d.nodes];
      const nextConnections = [...d.connections];
      if (modelId && modelName) {
        nextNodes.push({
          id: modelId,
          type: 'aiChatModel',
          name: modelName,
          position: { x: position.x - 200, y: position.y },
          parameters: defaultNodeParameters('aiChatModel'),
        });
      }
      nextNodes.push({
        id,
        type,
        name: uniqueName,
        position,
        parameters: defaultNodeParameters(type),
      });
      if (modelId) {
        nextConnections.push({
          from: modelId,
          to: id,
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        });
      }
      return {
        ...d,
        nodes: nextNodes,
        connections: nextConnections,
      };
    });
    setSelectedNodeId(id);
    setJsonDraftsByNode((prev) => {
      const drafts: Record<string, ReturnType<typeof initJsonDraftsForNode>> = { ...prev };
      if (modelId && modelName) {
        drafts[modelId] = initJsonDraftsForNode({
          id: modelId,
          type: 'aiChatModel',
          name: modelName,
          position: { x: 0, y: 0 },
          parameters: defaultNodeParameters('aiChatModel'),
        });
      }
      drafts[id] = initJsonDraftsForNode({
        id,
        type,
        name: uniqueName,
        position: { x: 0, y: 0 },
        parameters: defaultNodeParameters(type),
      });
      return drafts;
    });
    setDirty(true);
  };

  const updateNode = (nodeId: string, patch: Partial<WorkflowDefinition['nodes'][number]>) => {
    debouncedCommit((d) => ({
      ...d,
      nodes: d.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const merged = { ...n, ...patch };
        if ('runner' in patch && patch.runner === undefined) {
          const { runner: _removed, ...withoutRunner } = merged;
          return withoutRunner;
        }
        return merged;
      }),
    }));
    setDirty(true);
  };

  const toggleNodeDisabled = (nodeId: string) => {
    commitDefinition((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === nodeId ? { ...n, disabled: !n.disabled } : n,
      ),
    }));
    setDirty(true);
  };

  const duplicateNode = (nodeId: string) => {
    const source = definition.nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const id = crypto.randomUUID();
    const copyName = ensureUniqueNodeName(
      definition.nodes.map((n) => n.name),
      t(labels, 'workflow.nameCopy', { name: source.name.trim() }),
    );
    const copy = {
      ...source,
      id,
      name: copyName,
      position: snapPointToGrid({
        x: source.position.x + 48,
        y: source.position.y + 48,
      }),
    };
    commitDefinition((d) => ({
      ...d,
      nodes: [...d.nodes, copy],
    }));
    setSelectedNodeId(id);
    setJsonDraftsByNode((prev) => ({
      ...prev,
      [id]: initJsonDraftsForNode(copy),
    }));
    setDirty(true);
  };

  const deleteNode = useCallback(
    (nodeId: string) => {
      commitDefinition((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => n.id !== nodeId),
        connections: d.connections.filter((c) => c.from !== nodeId && c.to !== nodeId),
      }));
      setSelectedNodeId(null);
      setNodeDebug((d) => {
        const next = { ...d };
        delete next[nodeId];
        return next;
      });
      setPinData((p) => {
        const next = { ...p };
        delete next[nodeId];
        return next;
      });
      setJsonDraftsByNode((d) => {
        const next = { ...d };
        delete next[nodeId];
        return next;
      });
      setDirty(true);
    },
    [commitDefinition],
  );

  const handleDeleteSelectedNode = useCallback(
    (nodeId: string) => {
      flushPending();
      deleteNode(nodeId);
    },
    [flushPending, deleteNode],
  );

  useDeleteSelectedNodeShortcut(selectedNodeId, handleDeleteSelectedNode, true);

  const clearDebug = () => {
    currentDebugRunRef.current = null;
    resetRunOrder();
    setNodeDebug({});
    setPinData({});
    setPinBranchData({});
    setError(null);
  };

  const handlePublish = async (publishNote: string) => {
    if (!workflowId || isNewWorkflow) return;
    await flushAutoSave();
    await api.workflows.publish(workflowId, { publishNote });
    await refreshWorkflowMeta();
    setShowPublishDialog(false);
  };

  const handleUnpublish = async () => {
    if (!workflowId || isNewWorkflow) return;
    const ok = await confirm({
      title: t(labels, 'auto.t_2761f9be'),
      message: t(labels, 'auto.Webhook_63c79889'),
      confirmLabel: t(labels, 'auto.t_2761f9be'),
      danger: true,
    });
    if (!ok) return;
    await api.workflows.unpublish(workflowId);
    setPublishStatus('draft');
  };

  const openPublishDialog = () => {
    void flushAutoSave().then(() => setShowPublishDialog(true));
  };

  const canShare =
    accessRole === 'admin' || accessRole === 'owner' || accessRole === 'editor';
  const canEditSkillSettings =
    accessRole === 'admin' ||
    accessRole === 'owner' ||
    accessRole === 'editor' ||
    accessRole == null;

  return (
    <div className="workflow-editor">
      {dialog}
      <PublishDialog
        open={showPublishDialog}
        onCancel={() => setShowPublishDialog(false)}
        onConfirm={(publishNote) => void handlePublish(publishNote)}
      />
      <WorkflowSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        runnerPolicy={runnerPolicy}
        runners={runnerOptions}
        onRunnerPolicyChange={(p) => {
          setRunnerPolicy(p);
          setDirty(true);
        }}
        exposeAsTool={exposeAsTool}
        exposeAsToolDescription={exposeAsToolDescription}
        onExposeAsToolChange={(patch) => {
          if (patch.exposeAsTool !== undefined) setExposeAsTool(patch.exposeAsTool);
          if (patch.exposeAsToolDescription !== undefined) {
            setExposeAsToolDescription(patch.exposeAsToolDescription);
          }
          setDirty(true);
        }}
        enableCrew={enableCrew}
        onEnableCrewChange={(enabled) => {
          commitDefinition((d) => ({
            ...d,
            settings: { ...d.settings, enableCrew: enabled },
          }));
          setDirty(true);
        }}
        workflowId={workflowId}
        canShowCollaborators={Boolean(workflowId && !isNewWorkflow)}
        canShare={canShare}
      />
      {workflowId && !isNewWorkflow && (
        <PublishHistoryModal
          open={showPublishHistory}
          onClose={() => setShowPublishHistory(false)}
          workflowId={workflowId}
          onDraftRestored={() => {
            void api.workflows.get(workflowId).then((w) => {
              replaceDefinition(w.definition);
              setPublishStatus(w.status === 'published' ? 'published' : 'draft');
              setPublishedSemver(w.publishedSemverLabel ?? null);
              setHasUnpublishedChanges(Boolean(w.hasUnpublishedChanges));
              setDirty(false);
            });
          }}
          onPublishChanged={() => {
            void refreshWorkflowMeta();
          }}
        />
      )}
      {error && <p className="error">{error}</p>}
      <div className="editor-main" ref={editorMainRef}>
        <LoadingHost
          loading={loading || (replayLoading && isExecutionsTab)}
          className="editor-main-loading-host"
          label={
            loading
              ? t(labels, 'editor.loadingWorkflow')
              : t(labels, 'common.loading')
          }
        >
        <div className="editor-workspace" ref={editorWorkspaceRef}>
        <div className="editor-grid" ref={editorGridRef}>
          <div
            className="editor-palette-pane"
            style={{ width: layoutPrefs.paletteWidthPx }}
          >
            {isExecutionsTab && workflowId && !isNewWorkflow ? (
              <WorkflowExecutionsSidebar
                workflowId={workflowId}
                selectedExecutionId={executionId ?? null}
                basePath={basePath}
                refreshKey={executionsRefreshKey}
              />
            ) : (
              <EditorLeftPane
                workflowId={workflowId}
                isNewWorkflow={isNewWorkflow}
                isExecutionsView={false}
                selectedExecutionId={executionId ?? null}
                basePath={basePath}
                executionsRefreshKey={executionsRefreshKey}
                enableCrew={enableCrew}
                onAddNode={addNode}
              />
            )}
          </div>
          <div
            className="editor-palette-resize-strip"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={layoutPrefs.paletteWidthPx}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startW = layoutPrefs.paletteWidthPx;
              const containerW = editorGridRef.current?.getBoundingClientRect().width;
              const move = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                updateLayoutPrefs({
                  paletteWidthPx: clampPaletteWidth(startW + delta, containerW),
                });
              };
              const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', move);
              document.addEventListener('mouseup', up);
            }}
          />
          <div className="editor-canvas-pane">
            <EditorCanvasHeader
              basePath={basePath}
              executionsDisabled={isNewWorkflow}
              workflowName={definition.name}
              autoSaveStatus={autoSaveStatus}
              publishStatus={publishStatus}
              publishedSemver={publishedSemver}
              hasUnpublishedChanges={hasUnpublishedChanges}
              showChat={showChat}
              canShowPublishHistory={Boolean(workflowId && !isNewWorkflow)}
              canPublish={Boolean(workflowId && !isNewWorkflow)}
              showCopyToEditor={Boolean(isExecutionsTab && executionId)}
              onOpenPublishHistory={() => setShowPublishHistory(true)}
              onOpenSettings={() => setShowSettings(true)}
              onToggleChat={() => setShowChat((s) => !s)}
              onPublish={openPublishDialog}
              onUnpublish={() => void handleUnpublish()}
              onCopyToEditor={handleCopyToEditor}
            />
            {replayError && isExecutionsTab && (
              <p className="error editor-canvas-hint">{replayError}</p>
            )}
            {isExecutionsTab && executionId && (
              <HitlApprovalBanner
                executionId={executionId}
                detail={polledDetail ?? replayDetail}
                onResolved={() => {
                  void api.executions.get(executionId).then(applyExecutionDetail);
                  setExecutionsRefreshKey((k) => k + 1);
                }}
              />
            )}
            {(isNewWorkflow || !loading) && (
            <WorkflowCanvas
              key={workflowId ?? 'new'}
              definition={canvasDefinition}
              readOnly={isExecutionsTab}
              onRegisterFlowCenter={registerFlowCenter}
              onChange={(d) => {
                commitDefinition(() => d);
                setDirty(true);
              }}
              onDragStop={(d) => {
                void flushAutoSave({ force: true, definition: d });
              }}
              onNodeSelect={setSelectedNodeId}
              onNodeDoubleClick={(id) => setEditorNodeId(id)}
              nodeDebug={canvasNodeDebug}
              selectedNodeId={selectedNodeId}
              onExecuteNode={executeNode}
              onToggleNodeDisabled={toggleNodeDisabled}
              onDeleteNode={(id) => {
                deleteNode(id);
                if (editorNodeId === id) setEditorNodeId(null);
              }}
              onDuplicateNode={duplicateNode}
              focusNodeId={focusNodeId}
            />
            )}
          </div>
        </div>
        {!layoutPrefs.logCollapsed && (
          <div
            className="editor-log-panel-resize-strip"
            role="separator"
            aria-orientation="horizontal"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = layoutPrefs.logHeightPx;
              const move = (ev: MouseEvent) => {
                const delta = startY - ev.clientY;
                const workspaceH =
                  editorWorkspaceRef.current?.getBoundingClientRect().height;
                updateLayoutPrefs({
                  logHeightPx: clampLogHeight(startH + delta, workspaceH),
                });
              };
              const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
              };
              document.addEventListener('mousemove', move);
              document.addEventListener('mouseup', up);
            }}
          />
        )}
        <EditorLogPanel
          definition={canvasDefinition}
          selectedNodeId={selectedNodeId}
          nodeDebug={canvasNodeDebug}
          currentRunId={null}
          pinData={canvasPinData}
          pinBranchData={canvasPinBranchData}
          collapsed={layoutPrefs.logCollapsed}
          heightPx={layoutPrefs.logHeightPx}
          logSplit={layoutPrefs.logPanelSplit}
          onLogSplitChange={(patch) => updateLayoutPrefs({ logPanelSplit: patch })}
          onSelectNode={setSelectedNodeId}
          onClearExecutionData={isExecutionsTab ? () => undefined : clearDebug}
          onToggleCollapsed={() =>
            updateLayoutPrefs({ logCollapsed: !layoutPrefs.logCollapsed })
          }
        />
        </div>
        {showChat && workflowId && !isNewWorkflow && (
          <>
            <div
              className="editor-chat-resize-strip"
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={layoutPrefs.chatWidthPx}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startW = layoutPrefs.chatWidthPx;
                const containerW = editorMainRef.current?.getBoundingClientRect().width;
                const move = (ev: MouseEvent) => {
                  const delta = startX - ev.clientX;
                  updateLayoutPrefs({
                    chatWidthPx: clampChatWidth(startW + delta, containerW),
                  });
                };
                const up = () => {
                  document.removeEventListener('mousemove', move);
                  document.removeEventListener('mouseup', up);
                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';
                };
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
              }}
            />
            <EditorChatSidebar
              workflowId={workflowId}
              workflowName={definition.name}
              widthPx={layoutPrefs.chatWidthPx}
              onClose={() => setShowChat(false)}
            />
          </>
        )}
        </LoadingHost>
      </div>
      {editorNodeId && (
        <NodeEditorModal
          definition={definition}
          nodeId={editorNodeId}
          workflowId={workflowId ?? 'new'}
          publicUrl={publicUrl}
          published={publishStatus === 'published'}
          nodeDebug={nodeDebug}
          pinData={pinData}
          pinBranchData={pinBranchData}
          webhookListenErrors={webhookListenErrors}
          onSplitChange={(modalSplit) => updateLayoutPrefs({ modalSplit })}
          onClose={() => {
            if (jsonParamError) return;
            if (jsonFlushTimerRef.current) {
              clearTimeout(jsonFlushTimerRef.current);
              jsonFlushTimerRef.current = null;
            }
            if (!flushJsonDraftsForNode(editorNodeId)) return;
            flushPending();
            setEditorNodeId(null);
          }}
          onUpdateNode={updateNode}
          onExecuteNode={executeNode}
          onExecutePredecessors={executePredecessors}
          jsonDrafts={jsonDraftsByNode[editorNodeId] ?? {}}
          onJsonDraftChange={(key, text) => {
            setJsonParamError(null);
            setJsonDraftsByNode((prev) => ({
              ...prev,
              [editorNodeId]: {
                ...(prev[editorNodeId] ?? {}),
                [key]: text,
              },
            }));
            scheduleJsonDraftFlush(editorNodeId);
          }}
          jsonError={jsonParamError}
          blockClose={Boolean(jsonParamError)}
          workflowRunnerPolicy={runnerPolicy}
          runnerOptions={runnerOptions}
          onPatchWorkflowDefinition={(updater) => {
            commitDefinition(updater);
            setDirty(true);
          }}
          onReplaceWorkflowDefinition={(def) => {
            void confirm({
              title: t(labels, 'editor.workflowRun.importConfirmTitle'),
              message: t(labels, 'editor.workflowRun.importConfirmMessage'),
              confirmLabel: t(labels, 'common.confirm'),
            }).then((ok) => {
              if (!ok) return;
              replaceDefinition(def);
              setDirty(true);
            });
          }}
        />
      )}
    </div>
  );
}
