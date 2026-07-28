import { useEffect, useMemo, useState } from 'react';
import type { WorkflowDefinition } from '../../api/client.js';
import { api } from '../../api/client.js';
import { t, useLabels } from '../../i18n/labels.js';
import {
  buildAgentChatModelInputSources,
  buildAgentKnowledgeInputSources,
  buildAgentMemoryInputSources,
  buildAgentOutputParserInputSources,
  buildAgentToolInputSources,
  findAgentChatModelHub,
  findAgentKnowledgeHub,
  findAgentMemoryHub,
  findAgentOutputParserHub,
  findAgentToolHub,
  hasModelInvokeData,
  hasParserInvokeData,
  hasToolInvokeData,
  isAgentChatModelSatelliteType,
  isAgentKnowledgeSatelliteType,
  isAgentMemorySatelliteType,
  isAgentOutputParserSatelliteType,
  isAgentToolSatelliteType,
  MODEL_INVOKE_SOURCE_ID,
  OUTPUT_PARSER_INVOKE_SOURCE_ID,
  TOOL_INVOKE_SOURCE_ID,
  resolveDefaultAgentChatModelSourceId,
  resolveDefaultAgentKnowledgeSourceId,
  resolveDefaultAgentMemorySourceId,
  resolveDefaultAgentOutputParserSourceId,
  resolveDefaultAgentToolSourceId,
} from './agent-tool-input-sources.js';
import {
  buildEditorContextSource,
  platformEnvItemsToMap,
  testSettingsToMap,
} from './build-editor-context-globals.js';
import { DataInspector } from './data-inspector/DataInspector.js';
import { DataInspectorSearchBar } from './data-inspector/DataInspectorSearchBar.js';
import type { DataInspectorSource } from './data-inspector/types.js';
import type { NodeDebugState, PinDataMap } from './editor-debug-types.js';
import type { ExecutePredecessorsFn } from './execute-node.js';
import { firstEdgeOnPathToTarget, type PinBranchDataMap } from './branch-path-utils.js';
import {
  areMainFlowPredecessorsExecuted,
  findMainFlowTriggerOnPath,
  getDirectMainFlowPredecessor,
  listMainFlowPredecessorNodes,
} from './main-flow-predecessors.js';
import { resolvePredecessorItems } from './resolve-predecessor-items.js';
import {
  buildDragPayload,
  buildJsonDragExpression,
  buildNodesDragExpression,
  serializeExprDrag,
} from './drag-expression.js';

function hasInputExecutionData(
  nodeDebug: Record<string, NodeDebugState>,
  pinData: PinDataMap,
  pinBranchData: PinBranchDataMap,
): boolean {
  if (Object.keys(pinData).length > 0) return true;
  if (Object.keys(pinBranchData).length > 0) return true;
  return Object.values(nodeDebug).some(
    (state) =>
      state.status === 'running' || state.status === 'success' || state.status === 'failed',
  );
}

function findExecutionRunId(nodeDebug: Record<string, NodeDebugState>): string | undefined {
  for (const state of Object.values(nodeDebug)) {
    if (state.runId && state.status !== 'idle' && state.status !== 'waiting') {
      return state.runId;
    }
  }
  return undefined;
}

export function InputDataPanel({
  definition,
  workflowId,
  nodeId,
  pinData,
  pinBranchData = {},
  nodeDebug,
  onExecutePredecessors,
}: {
  definition: WorkflowDefinition;
  workflowId?: string;
  nodeId: string;
  pinData: PinDataMap;
  pinBranchData?: PinBranchDataMap;
  nodeDebug: Record<string, NodeDebugState>;
  onExecutePredecessors: ExecutePredecessorsFn;
}) {
  const labels = useLabels();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState('');
  const [contextSettings, setContextSettings] = useState<{
    vars: Record<string, string>;
    env: Record<string, string | number | boolean>;
  }>({ vars: {}, env: {} });

  const currentNode = definition.nodes.find((n) => n.id === nodeId);
  const isAgentToolSatellite =
    currentNode != null && isAgentToolSatelliteType(currentNode.type);
  const isAgentChatModelSatellite =
    currentNode != null && isAgentChatModelSatelliteType(currentNode.type);
  const isAgentMemorySatellite =
    currentNode != null && isAgentMemorySatelliteType(currentNode.type);
  const isAgentKnowledgeSatellite =
    currentNode != null && isAgentKnowledgeSatelliteType(currentNode.type);
  const isAgentOutputParserSatellite =
    currentNode != null && isAgentOutputParserSatelliteType(currentNode.type);
  const isHubResourceSatellite =
    isAgentToolSatellite ||
    isAgentChatModelSatellite ||
    isAgentMemorySatellite ||
    isAgentKnowledgeSatellite ||
    isAgentOutputParserSatellite;
  const agentToolHub = isAgentToolSatellite ? findAgentToolHub(definition, nodeId) : null;
  const agentChatModelHub = isAgentChatModelSatellite
    ? findAgentChatModelHub(definition, nodeId)
    : null;
  const agentMemoryHub = isAgentMemorySatellite ? findAgentMemoryHub(definition, nodeId) : null;
  const agentKnowledgeHub = isAgentKnowledgeSatellite
    ? findAgentKnowledgeHub(definition, nodeId)
    : null;
  const agentOutputParserHub = isAgentOutputParserSatellite
    ? findAgentOutputParserHub(definition, nodeId)
    : null;
  const hubResource =
    agentToolHub ??
    agentChatModelHub ??
    agentMemoryHub ??
    agentKnowledgeHub ??
    agentOutputParserHub;
  const flowAnchorId = hubResource?.id ?? nodeId;

  const mainPredecessors = useMemo(
    () => listMainFlowPredecessorNodes(definition, flowAnchorId),
    [definition, flowAnchorId],
  );

  useEffect(() => {
    setActiveSourceId('');
  }, [nodeId]);

  const hasTriggerOnPath = findMainFlowTriggerOnPath(definition, flowAnchorId) != null;
  const predecessorsExecuted = areMainFlowPredecessorsExecuted(
    definition,
    flowAnchorId,
    pinData,
    pinBranchData,
    nodeDebug,
  );
  const toolInvokeReady = isAgentToolSatellite && hasToolInvokeData(nodeDebug[nodeId]);
  const modelInvokeReady =
    isAgentChatModelSatellite && hasModelInvokeData(nodeDebug[nodeId]);
  const parserInvokeReady =
    isAgentOutputParserSatellite && hasParserInvokeData(nodeDebug[nodeId]);
  const hubInvokeReady = toolInvokeReady || modelInvokeReady || parserInvokeReady;

  const predecessorRunning = mainPredecessors.some(
    (pred) => nodeDebug[pred.id]?.status === 'running',
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.variables.list(), api.env.list()])
      .then(([variables, env]) => {
        if (cancelled) return;
        setContextSettings({
          vars: testSettingsToMap(variables),
          env: platformEnvItemsToMap(env),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setContextSettings({ vars: {}, env: {} });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const predecessorSources: DataInspectorSource[] = useMemo(() => {
    if (isAgentToolSatellite && agentToolHub) {
      return buildAgentToolInputSources({
        definition,
        toolNodeId: nodeId,
        hubId: agentToolHub.id,
        labels,
        pinData,
        pinBranchData,
        nodeDebug,
      });
    }
    if (isAgentChatModelSatellite && agentChatModelHub) {
      return buildAgentChatModelInputSources({
        definition,
        modelNodeId: nodeId,
        hubId: agentChatModelHub.id,
        labels,
        pinData,
        pinBranchData,
        nodeDebug,
      });
    }
    if (isAgentMemorySatellite && agentMemoryHub) {
      return buildAgentMemoryInputSources({
        definition,
        memoryNodeId: nodeId,
        hubId: agentMemoryHub.id,
        labels,
        pinData,
        pinBranchData,
        nodeDebug,
      });
    }
    if (isAgentKnowledgeSatellite && agentKnowledgeHub) {
      return buildAgentKnowledgeInputSources({
        definition,
        knowledgeNodeId: nodeId,
        hubId: agentKnowledgeHub.id,
        labels,
        pinData,
        pinBranchData,
        nodeDebug,
      });
    }
    if (isAgentOutputParserSatellite && agentOutputParserHub) {
      return buildAgentOutputParserInputSources({
        definition,
        parserNodeId: nodeId,
        hubId: agentOutputParserHub.id,
        labels,
        pinData,
        pinBranchData,
        nodeDebug,
      });
    }
    return mainPredecessors.map((pred) => {
      const edge = firstEdgeOnPathToTarget(definition, pred.id, flowAnchorId);
      const items = resolvePredecessorItems(
        pred.id,
        pinData,
        nodeDebug,
        edge?.fromOutput,
        pinBranchData,
        definition,
        nodeId,
      );
      return {
        id: pred.id,
        label: pred.name,
        items,
        icon: 'node' as const,
      };
    });
  }, [
    agentChatModelHub,
    agentKnowledgeHub,
    agentMemoryHub,
    agentOutputParserHub,
    agentToolHub,
    definition,
    flowAnchorId,
    isAgentChatModelSatellite,
    isAgentKnowledgeSatellite,
    isAgentMemorySatellite,
    isAgentOutputParserSatellite,
    isAgentToolSatellite,
    labels,
    mainPredecessors,
    nodeDebug,
    nodeId,
    pinBranchData,
    pinData,
  ]);

  const showContext =
    !isHubResourceSatellite && hasInputExecutionData(nodeDebug, pinData, pinBranchData);

  const contextSource = showContext
    ? buildEditorContextSource({
        definition,
        workflowId,
        nodeId,
        vars: contextSettings.vars,
        env: contextSettings.env,
        executionPreview: {
          id: findExecutionRunId(nodeDebug),
          mode: 'test',
          environment: 'test',
        },
      })
    : null;

  const sources: DataInspectorSource[] = contextSource
    ? [...predecessorSources, contextSource]
    : predecessorSources;

  const defaultInputSourceId = useMemo(() => {
    if (isAgentToolSatellite && agentToolHub) {
      return resolveDefaultAgentToolSourceId(sources, definition, agentToolHub.id);
    }
    if (isAgentChatModelSatellite && agentChatModelHub) {
      return resolveDefaultAgentChatModelSourceId(sources, definition, agentChatModelHub.id);
    }
    if (isAgentMemorySatellite && agentMemoryHub) {
      return resolveDefaultAgentMemorySourceId(sources, definition, agentMemoryHub.id);
    }
    if (isAgentKnowledgeSatellite && agentKnowledgeHub) {
      return resolveDefaultAgentKnowledgeSourceId(sources, definition, agentKnowledgeHub.id);
    }
    if (isAgentOutputParserSatellite && agentOutputParserHub) {
      return resolveDefaultAgentOutputParserSourceId(
        sources,
        definition,
        agentOutputParserHub.id,
      );
    }
    const nodePredecessorSources = predecessorSources.filter((s) => s.icon === 'node');
    const predecessorIds = new Set(nodePredecessorSources.map((s) => s.id));
    const direct = getDirectMainFlowPredecessor(definition, flowAnchorId);
    if (direct && predecessorIds.has(direct.id)) return direct.id;
    const lastMain = mainPredecessors[mainPredecessors.length - 1];
    if (lastMain && predecessorIds.has(lastMain.id)) return lastMain.id;
    return nodePredecessorSources[0]?.id ?? '';
  }, [
    agentChatModelHub,
    agentKnowledgeHub,
    agentMemoryHub,
    agentOutputParserHub,
    agentToolHub,
    definition,
    flowAnchorId,
    isAgentChatModelSatellite,
    isAgentKnowledgeSatellite,
    isAgentMemorySatellite,
    isAgentOutputParserSatellite,
    isAgentToolSatellite,
    mainPredecessors,
    predecessorSources,
    sources,
  ]);

  const effectiveActiveSourceId = activeSourceId || defaultInputSourceId;

  const buildDragExpression = (path: string[], source: DataInspectorSource) => {
    if (source.icon === 'context') {
      return serializeExprDrag(buildDragPayload('context', path));
    }
    if (source.id === nodeId) {
      return serializeExprDrag({
        kind: 'json',
        path,
        expression: buildJsonDragExpression(path),
      });
    }
    return serializeExprDrag({
      kind: 'nodes',
      nodeName: source.label,
      path,
      expression: buildNodesDragExpression(source.label, path),
    });
  };

  const activeSource = sources.find((s) => s.id === effectiveActiveSourceId);
  const showToolInvokePending =
    isAgentToolSatellite &&
    effectiveActiveSourceId === TOOL_INVOKE_SOURCE_ID &&
    (activeSource?.items.length ?? 0) === 0;
  const showModelInvokePending =
    isAgentChatModelSatellite &&
    effectiveActiveSourceId === MODEL_INVOKE_SOURCE_ID &&
    (activeSource?.items.length ?? 0) === 0;
  const showParserInvokePending =
    isAgentOutputParserSatellite &&
    effectiveActiveSourceId === OUTPUT_PARSER_INVOKE_SOURCE_ID &&
    (activeSource?.items.length ?? 0) === 0;

  const showDataInspector = isHubResourceSatellite
    ? hubResource != null &&
      hasTriggerOnPath &&
      (predecessorsExecuted || hubInvokeReady) &&
      sources.length > 0
    : hasTriggerOnPath && predecessorsExecuted && mainPredecessors.length > 0;
  const showExecutePredecessors = isHubResourceSatellite
    ? hubResource != null &&
      hasTriggerOnPath &&
      mainPredecessors.length > 0 &&
      !predecessorsExecuted &&
      !hubInvokeReady
    : hasTriggerOnPath && mainPredecessors.length > 0 && !predecessorsExecuted;

  return (
    <div className="node-editor-pane node-editor-input-pane">
      <div className="node-editor-pane-head">
        <h4>{t(labels, 'editor.input')}</h4>
        {showDataInspector && (
          <DataInspectorSearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sources={sources}
            activeSourceId={effectiveActiveSourceId}
            onActiveSourceChange={setActiveSourceId}
            showSourceSelect
          />
        )}
      </div>
      <div
        className={`node-editor-pane-body${
          showExecutePredecessors && !showDataInspector
            ? ' node-editor-pane-body--predecessors-pending'
            : ''
        }`}
      >
        {isAgentToolSatellite && !agentToolHub ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.toolNotConnectedToAgent')}</p>
          </div>
        ) : isAgentChatModelSatellite && !agentChatModelHub ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.modelNotConnectedToAgent')}</p>
          </div>
        ) : isAgentMemorySatellite && !agentMemoryHub ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.memoryNotConnectedToAgent')}</p>
          </div>
        ) : isAgentKnowledgeSatellite && !agentKnowledgeHub ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.knowledgeNotConnectedToAgent')}</p>
          </div>
        ) : isAgentOutputParserSatellite && !agentOutputParserHub ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.parserNotConnectedToAgent')}</p>
          </div>
        ) : !hasTriggerOnPath ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.requiresTriggerNode')}</p>
          </div>
        ) : !isHubResourceSatellite && mainPredecessors.length === 0 ? (
          <div className="node-editor-pane-empty">
            <p className="hint">{t(labels, 'editor.noUpstreamNodes')}</p>
          </div>
        ) : (
          <>
            {showExecutePredecessors && (
              <div className="input-data-node-head">
                <button
                  type="button"
                  className="btn-execute-node btn-execute-node--inline"
                  disabled={predecessorRunning}
                  onClick={() => void onExecutePredecessors(flowAnchorId)}
                >
                  {predecessorRunning ? (
                    <span>{t(labels, 'auto.t_666b4aff')}</span>
                  ) : (
                    <>
                      <span aria-hidden>▶</span>
                      <span>{t(labels, 'editor.executePredecessors')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
            {showDataInspector && (
              <>
                <DataInspector
                  sources={sources}
                  activeSourceId={effectiveActiveSourceId}
                  onActiveSourceChange={setActiveSourceId}
                  searchQuery={searchQuery}
                  draggable
                  buildDragExpression={buildDragExpression}
                />
                {showToolInvokePending && (
                  <p className="hint input-data-tool-invoke-pending">
                    {t(labels, 'editor.toolInvokePending')}
                  </p>
                )}
                {showModelInvokePending && (
                  <p className="hint input-data-tool-invoke-pending">
                    {t(labels, 'editor.modelInvokePending')}
                  </p>
                )}
                {showParserInvokePending && (
                  <p className="hint input-data-tool-invoke-pending">
                    {t(labels, 'editor.parserInvokePending')}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
