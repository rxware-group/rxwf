import { useEffect, useMemo, useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { api, type WorkflowDefinition } from '../../api/client.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];
import type { NodeDebugState } from './editor-debug-types.js';
import { HttpOutputPreview } from './HttpOutputPreview.js';
import { DebugErrorPreview } from './DebugErrorPreview.js';
import { resolveDebugOutputItems, resolveNodeOutputPreview } from './editor-log-utils.js';
import { parseOutputParserSchema } from './output-parser-schema.js';
import { formatJsonData, JsonDataViewer } from './JsonDataViewer.js';
import { getOutputBranchLabels, mapNodeOutputBranches } from './node-port-defs.js';
import { isSatelliteNodeType } from './main-flow-predecessors.js';
import type { WorkflowItem } from './editor-debug-types.js';
import { DataInspector } from './data-inspector/DataInspector.js';
import { DataInspectorSearchBar } from './data-inspector/DataInspectorSearchBar.js';
import type { DataInspectorSource } from './data-inspector/types.js';
import {
  isStaticAgentSessionId,
  type AgentMemorySnapshotPreview,
} from './memory-output.js';

export function NodeEditorOutputPane({
  definition,
  nodeId,
  nodeDebug,
  onUpdateNode,
}: {
  definition: WorkflowDefinition;
  nodeId: string;
  nodeDebug: Record<string, NodeDebugState>;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}) {
  const labels = useLabels();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceId, setActiveSourceId] = useState('');

  const node = definition.nodes.find((item) => item.id === nodeId);
  const debug = nodeDebug[nodeId];
  const debugOutputPreview = resolveNodeOutputPreview(definition, nodeId, nodeDebug);
  const isMemoryNode = node?.type === 'aiMemory';
  const [persistedMemory, setPersistedMemory] = useState<AgentMemorySnapshotPreview | null>(null);

  useEffect(() => {
    if (!isMemoryNode) {
      setPersistedMemory(null);
      return;
    }
    if (debugOutputPreview !== null) {
      setPersistedMemory(null);
      return;
    }
    const sessionId = node?.parameters.sessionId;
    if (!isStaticAgentSessionId(sessionId)) {
      setPersistedMemory(null);
      return;
    }
    const maxTurns = Number(node?.parameters.maxTurns ?? 20);
    const limit = Math.max(2, Math.min(100, maxTurns * 2));
    let cancelled = false;
    void api.agentMemory
      .listSessionMessages(String(sessionId).trim(), { limit })
      .then((result) => {
        if (cancelled) return;
        setPersistedMemory({
          sessionId: result.sessionId,
          messages: result.messages.map((message) => ({
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          })),
        });
      })
      .catch(() => {
        if (!cancelled) setPersistedMemory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isMemoryNode,
    debugOutputPreview,
    node?.parameters.sessionId,
    node?.parameters.maxTurns,
  ]);

  const outputPreview =
    debugOutputPreview ??
    (persistedMemory
      ? { kind: 'single' as const, data: [persistedMemory] }
      : null);
  const isOutputParser = node?.type === 'aiOutputParser';
  const outputParserSchema =
    isOutputParser && outputPreview === null
      ? parseOutputParserSchema(node?.parameters)
      : null;
  const isHttpRequest = node?.type === 'httpRequest';
  const isMultiBranchOutput =
    debug?.status !== 'failed' &&
    outputPreview?.kind === 'branches' &&
    !(node && isSatelliteNodeType(node.type));
  const isPlaceholderOutput =
    !isOutputParser &&
    !isMultiBranchOutput &&
    (!debug ||
      debug.status === 'idle' ||
      debug.status === 'failed' ||
      outputPreview === null);

  const sources: DataInspectorSource[] = useMemo(() => {
    if (node && isSatelliteNodeType(node.type) && outputPreview?.kind === 'single') {
      const items = outputPreview.data.map((data) => ({ json: data as WorkflowItem['json'] }));
      if (!items.length) return [];
      return [
        {
          id: 'output',
          label: t(labels, 'editor.output'),
          items,
          icon: 'node' as const,
        },
      ];
    }
    const outputItems = resolveDebugOutputItems(definition, nodeId, nodeDebug);
    if (!outputItems) return [];
    const branchLabels =
      node && outputItems.length > 1
        ? getOutputBranchLabels(node.type, node.parameters)
        : [];
    if (branchLabels.length > 1 && outputItems.length > 1 && node) {
      return mapNodeOutputBranches(node.type, node.parameters, outputItems).map(
        (branch, index) => ({
          id: `branch-${index}`,
          label: branch.label,
          items: branch.items,
          icon: 'branch' as const,
        }),
      );
    }
    const flat = outputItems.flat();
    if (!flat.length) return [];
    return [
      {
        id: 'output',
        label: t(labels, 'editor.output'),
        items: flat,
        icon: 'node' as const,
      },
    ];
  }, [definition, nodeDebug, nodeId, labels, node, outputPreview]);

  const effectiveActiveId = activeSourceId || sources[0]?.id || '';

  const placeholderBody =
    !debug || debug.status === 'idle' ? (
      <p className="hint">{t(labels, 'editor.notExecutedYet')}</p>
    ) : debug.status === 'failed' ? (
      <DebugErrorPreview debug={debug} />
    ) : outputPreview === null ? (
      <p className="hint">{t(labels, 'editor.successNoOutput')}</p>
    ) : null;

  const outputBody =
    isHttpRequest && !isPlaceholderOutput ? (
      <HttpOutputPreview
        preview={outputPreview!}
        parameters={node?.parameters ?? {}}
        onParametersChange={(patch) => {
          if (!node) return;
          onUpdateNode(node.id, { parameters: { ...node.parameters, ...patch } });
        }}
      />
    ) : isOutputParser && (outputPreview || outputParserSchema !== null) ? (
      <JsonDataViewer
        value={formatJsonData(
          outputPreview?.kind === 'single' ? outputPreview.data : [outputParserSchema],
        )}
        searchQuery={searchQuery}
      />
    ) : isPlaceholderOutput ? (
      placeholderBody
    ) : (
      <DataInspector
        sources={sources}
        activeSourceId={effectiveActiveId}
        onActiveSourceChange={setActiveSourceId}
        searchQuery={searchQuery}
        jsonHeightMode="fill"
      />
    );

  const showJsonSearch =
    !isPlaceholderOutput && !isHttpRequest && !isMultiBranchOutput;

  return (
    <div className="node-editor-pane node-editor-output-pane">
      <div className="node-editor-pane-head">
        <h4>{t(labels, 'editor.output')}</h4>
        {showJsonSearch && (
          <DataInspectorSearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sources={sources}
            activeSourceId={effectiveActiveId}
            onActiveSourceChange={setActiveSourceId}
            showSourceSelect={sources.length > 1}
          />
        )}
      </div>
      <div className="node-editor-pane-body">
        {isMultiBranchOutput || (isHttpRequest && !isPlaceholderOutput) ? (
          outputBody
        ) : isPlaceholderOutput ? (
          <div className="node-editor-pane-empty">{outputBody}</div>
        ) : (
          <div className="debug-data-box">{outputBody}</div>
        )}
      </div>
    </div>
  );
}
