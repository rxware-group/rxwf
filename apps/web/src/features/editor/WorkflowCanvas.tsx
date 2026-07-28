import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { readThemeToken, useThemeId, useThemeVersion } from '../../hooks/use-theme-id.js';

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  PanOnScrollMode,
  SelectionMode,
  type Connection,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodeDrag,
  type IsValidConnection,
  type OnSelectionChangeFunc,
  type NodeChange,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import type { WorkflowDefinition } from '../../api/client.js';

import { WorkflowNode, type WorkflowNodeData } from './WorkflowNode.js';
import { WorkflowEdge } from './WorkflowEdge.js';
import { resolveEdgeOutputBadge } from './node-run-badge.js';
import {
  connectionEdgeId,
  edgeSourceRunStatus,
  pruneOrphanConnections,
} from './workflow-edge-utils.js';
import {
  isResourceConnection,
  outputHandleToIndex,
  resolveConnectionFromOutput,
} from './node-port-defs.js';
import { isCrewEditorEnabled } from './crew-editor-settings.js';
import { isValidWorkflowConnection } from './connection-rules.js';
import { FocusNodeBridge } from './FocusNodeBridge.js';
import { WorkflowConnectionLine } from './workflow-connection-line.js';
import { CANVAS_GRID_SIZE, snapPointToGrid } from './canvas-grid.js';
import { resolveFlowNodePositionAfterDefinitionUpdate } from './workflow-canvas-sync.js';
import { CanvasViewportWheel } from './CanvasViewportWheel.js';
import { FlowViewportCenterBridge } from './FlowViewportCenterBridge.js';
import type { FlowPositionGetter } from './flow-viewport-center.js';
import type { NodeDebugState } from './editor-debug-types.js';

export type WorkflowConnection = WorkflowDefinition['connections'][number];

type NodeCanvasActions = {
  onExecuteNode: (nodeId: string) => void;
  onToggleDisabled: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
};

function toFlow(
  definition: WorkflowDefinition,
  nodeDebug: Record<string, NodeDebugState>,
  actions: NodeCanvasActions,
  onDeleteEdge: (edgeId: string) => void,
  options: { readOnly?: boolean; edgesLocked?: boolean; enableCrew?: boolean },
  labels: LabelMap,
): { nodes: Node[]; edges: Edge[] } {
  const { readOnly = false, edgesLocked = readOnly, enableCrew = true } = options;

  const nodes: Node[] = definition.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: 'workflow',
    data: {
      label: n.name,
      nodeType: n.type,
      parameters: n.parameters,
      disabled: n.disabled,
      readOnly,
      debug: nodeDebug[n.id],
      onExecute: actions.onExecuteNode,
      onToggleDisabled: actions.onToggleDisabled,
      onDelete: actions.onDeleteNode,
      onDuplicate: actions.onDuplicateNode,
      onSelect: actions.onSelectNode,
      enableCrew,
    } satisfies WorkflowNodeData,
  }));

  const nodeById = new Map(definition.nodes.map((n) => [n.id, n]));

  const edges: Edge[] = pruneOrphanConnections(definition).map((c) => {
    const sourceNode = nodeById.get(c.from);
    const fromOutput = resolveConnectionFromOutput(
      sourceNode?.type,
      c.fromOutput,
      c.toInput,
    );
    const toInput = c.toInput ?? 'main';
    const id = connectionEdgeId({ ...c, fromOutput, toInput });
    const kind = isResourceConnection(fromOutput, toInput) ? 'resource' : 'main';
    const handleContext = {
      nodeType: sourceNode?.type,
      parameters: sourceNode?.parameters,
      outputIndex: c.outputIndex,
    };
    const outputBadge = resolveEdgeOutputBadge(
      labels,
      sourceNode?.type,
      c.from,
      fromOutput,
      nodeDebug,
      handleContext,
    );
    return {
      id,
      source: c.from,
      target: c.to,
      sourceHandle: fromOutput,
      targetHandle: toInput,
      type: 'workflow',
      data: {
        readOnly: edgesLocked,
        onDelete: edgesLocked ? undefined : () => onDeleteEdge(id),
        kind,
        sourceRunStatus: edgeSourceRunStatus(c.from, fromOutput, nodeDebug, handleContext),
        outputBadgeText: outputBadge?.text,
        outputBadgeStatus: outputBadge?.status,
      },
    };
  });

  return { nodes, edges };
}

function fromFlow(
  nodes: Node[],
  edges: Edge[],
  base: WorkflowDefinition,
): WorkflowDefinition {
  return {
    ...base,
    nodes: nodes.map((n) => {
      const existing = base.nodes.find((x) => x.id === n.id);
      const data = n.data as WorkflowNodeData;
      return {
        id: n.id,
        type: existing?.type ?? data.nodeType ?? 'set',
        name: data.label ?? existing?.name ?? n.id,
        position: n.position,
        parameters: data.parameters ?? existing?.parameters ?? {},
        disabled: existing?.disabled ?? data.disabled,
      };
    }),
    connections: edges
      .filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      .map((e) => {
        const sourceNode = base.nodes.find((n) => n.id === e.source);
        const toInput = e.targetHandle ?? 'main';
        const fromOutput = resolveConnectionFromOutput(
          sourceNode?.type,
          e.sourceHandle ?? undefined,
          toInput,
        );
        return {
          from: e.source,
          to: e.target,
          fromOutput,
          toInput,
          outputIndex: outputHandleToIndex(fromOutput, {
            nodeType: sourceNode?.type,
            parameters: sourceNode?.parameters,
          }),
        };
      }),
  };
}

const nodeTypes = { workflow: WorkflowNode };
const edgeTypes = { workflow: WorkflowEdge };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function WorkflowCanvas({
  definition,
  onChange,
  onNodeSelect,
  onNodeDoubleClick,
  nodeDebug,
  onExecuteNode,
  onToggleNodeDisabled,
  onDeleteNode,
  onDuplicateNode,
  onRegisterFlowCenter,
  onDragStop,
  focusNodeId,
  selectedNodeId = null,
  readOnly = false,
}: {
  definition: WorkflowDefinition;
  onChange: (def: WorkflowDefinition) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  nodeDebug: Record<string, NodeDebugState>;
  onExecuteNode: (nodeId: string) => void;
  onToggleNodeDisabled: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onRegisterFlowCenter?: (getter: FlowPositionGetter) => void;
  onDragStop?: (definition: WorkflowDefinition) => void;
  focusNodeId?: string | null;
  selectedNodeId?: string | null;
  readOnly?: boolean;
}) {
  const labels = useLabels();
  const [canvasInteractive, setCanvasInteractive] = useState(true);
  const [spacePressed, setSpacePressed] = useState(false);
  const [spacePanDragging, setSpacePanDragging] = useState(false);
  const spacePressedRef = useRef(false);
  spacePressedRef.current = spacePressed;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setSpacePressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setSpacePressed(false);
      setSpacePanDragging(false);
    };
    const clearSpace = () => {
      setSpacePressed(false);
      setSpacePanDragging(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearSpace);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearSpace);
    };
  }, []);

  const actions = useMemo(
    () => ({
      onExecuteNode,
      onToggleDisabled: onToggleNodeDisabled,
      onDeleteNode,
      onDuplicateNode,
      onSelectNode: (id: string) => onNodeSelect?.(id),
    }),
    [onExecuteNode, onToggleNodeDisabled, onDeleteNode, onDuplicateNode, onNodeSelect],
  );
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const enableCrew = isCrewEditorEnabled(definition.settings);

  const flowOptions = useMemo(
    () => ({
      readOnly,
      edgesLocked: readOnly || !canvasInteractive || spacePressed,
      enableCrew,
    }),
    [readOnly, canvasInteractive, spacePressed, enableCrew],
  );

  const initialFlow = useMemo(
    () => toFlow(definition, nodeDebug, actionsRef.current, () => {}, flowOptions, labels),
    [definition, nodeDebug, flowOptions, labels],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const definitionRef = useRef(definition);
  const isDraggingRef = useRef(false);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  definitionRef.current = definition;

  /** 仅同步节点坐标；连线以 definition 为准，避免 mouseup 时用陈旧 edgesRef 覆盖删除结果。 */
  const syncNodePositions = useCallback(() => {
    const base = definitionRef.current;
    const nextNodes = base.nodes.map((node) => {
      const flow = nodesRef.current.find((n) => n.id === node.id);
      if (!flow) return node;
      return { ...node, position: snapPointToGrid(flow.position) };
    });
    const moved = nextNodes.some((n, i) => {
      const prev = base.nodes[i]?.position;
      return prev && (n.position.x !== prev.x || n.position.y !== prev.y);
    });
    if (!moved) return;
    onChange({ ...base, nodes: nextNodes });
  }, [onChange]);

  const deleteEdge = useCallback(
    (edgeId: string) => {
      const nextEds = edgesRef.current.filter((e) => e.id !== edgeId);
      if (nextEds.length === edgesRef.current.length) return;
      setEdges(nextEds);
      onChange(fromFlow(nodesRef.current, nextEds, definitionRef.current));
    },
    [onChange, setEdges],
  );

  const deleteEdgeRef = useRef(deleteEdge);
  deleteEdgeRef.current = deleteEdge;

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'workflow' as const,
    }),
    [],
  );

  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const suppressSelectionChangeRef = useRef(false);

  useEffect(() => {
    const next = toFlow(
      definition,
      nodeDebug,
      actionsRef.current,
      (id) => deleteEdgeRef.current(id),
      flowOptions,
      labels,
    );
    setNodes((prev) =>
      next.nodes.map((n) => {
        const old = prev.find((p) => p.id === n.id);
        const defNode = definition.nodes.find((d) => d.id === n.id);
        if (!old || !defNode?.position) return n;
        const position = resolveFlowNodePositionAfterDefinitionUpdate(
          defNode.position,
          old.position,
          isDraggingRef.current,
        );
        return { ...n, position, selected: old.selected };
      }),
    );
    setEdges(next.edges);
  }, [definition, nodeDebug, flowOptions, labels, setNodes, setEdges]);

  /** Sync canvas highlight when selection changes from log panel / execution load. */
  useEffect(() => {
    suppressSelectionChangeRef.current = true;
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        const shouldSelect = selectedNodeId != null && n.id === selectedNodeId;
        if (Boolean(n.selected) === shouldSelect) return n;
        changed = true;
        return { ...n, selected: shouldSelect };
      });
      return changed ? next : prev;
    });
    const timer = window.setTimeout(() => {
      suppressSelectionChangeRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedNodeId, setNodes]);

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (suppressSelectionChangeRef.current) return;
      const nextId =
        selectedNodes.length === 0
          ? null
          : selectedNodes[selectedNodes.length - 1]!.id;
      if (nextId === selectedNodeIdRef.current) return;
      onNodeSelect?.(nextId);
    },
    [onNodeSelect],
  );

  const onNodeDoubleClickHandler: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (readOnly || spacePressedRef.current) return;
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick, readOnly],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (edge) => {
      if (!edge || typeof edge !== 'object') return false;
      const c = edge as Connection;
      if (!c.source || !c.target || c.source === c.target) return false;
      return isValidWorkflowConnection(definition, {
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
      });
    },
    [definition],
  );

  useEffect(() => {
    if (!spacePressed) {
      setSpacePanDragging(false);
      return;
    }

    const endSpacePanDrag = () => {
      if (spacePressedRef.current) setSpacePanDragging(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !spacePressedRef.current) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.canvas-panel .react-flow')) return;
      if (target.closest('.react-flow__controls, .react-flow__minimap')) return;
      setSpacePanDragging(true);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', endSpacePanDrag, true);
    window.addEventListener('pointercancel', endSpacePanDrag, true);
    window.addEventListener('mouseup', endSpacePanDrag, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', endSpacePanDrag, true);
      window.removeEventListener('pointercancel', endSpacePanDrag, true);
      window.removeEventListener('mouseup', endSpacePanDrag, true);
    };
  }, [spacePressed]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !canvasInteractive || spacePressedRef.current) return;
      if (!connection.source || !connection.target) return;
      const fromOutput = connection.sourceHandle ?? 'main';
      const toInput = connection.targetHandle ?? 'main';
      const id = connectionEdgeId({
        from: connection.source,
        to: connection.target,
        fromOutput,
        toInput,
      });
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            id,
            type: 'workflow',
          },
          eds,
        );
        onChange(fromFlow(nodesRef.current, next, definitionRef.current));
        return next;
      });
    },
    [onChange, setEdges, readOnly, canvasInteractive],
  );

  const onSelectionChangeGuarded: OnSelectionChangeFunc = useCallback(
    (params) => {
      if (spacePressedRef.current) return;
      onSelectionChange(params);
    },
    [onSelectionChange],
  );

  const canEditCanvas = !readOnly && canvasInteractive && !spacePressed;

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!canEditCanvas) {
        onNodesChange(changes);
        return;
      }
      onNodesChange(
        changes.map((change) =>
          change.type === 'position' && change.position && change.dragging
            ? { ...change, position: snapPointToGrid(change.position) }
            : change,
        ),
      );
    },
    [canEditCanvas, onNodesChange],
  );

  const onNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!canEditCanvas) return;
      isDraggingRef.current = true;
      onNodeSelect?.(node.id);
    },
    [canEditCanvas, onNodeSelect],
  );

  const onNodeDragStop = useCallback(() => {
    if (readOnly) return;
    isDraggingRef.current = false;
    const snappedFlowNodes = nodesRef.current.map((node) => ({
      ...node,
      position: snapPointToGrid(node.position),
    }));
    setNodes(snappedFlowNodes);
    nodesRef.current = snappedFlowNodes;
    const base = definitionRef.current;
    const nextNodes = base.nodes.map((node) => {
      const flow = snappedFlowNodes.find((n) => n.id === node.id);
      if (!flow) return node;
      return { ...node, position: flow.position };
    });
    const nextDefinition = { ...base, nodes: nextNodes };
    onChange(nextDefinition);
    onDragStop?.(nextDefinition);
  }, [onChange, onDragStop, readOnly, setNodes]);

  const themeId = useThemeId();
  const themeVersion = useThemeVersion();
  const isLight = themeId === 'light';
  const gridColor = useMemo(
    () => readThemeToken('--rxwf-grid', '#30363d'),
    [themeVersion],
  );

  const canvasPanelClass = [
    'panel',
    'canvas-panel',
    readOnly ? 'canvas-panel--replay' : '',
    spacePressed ? 'canvas-panel--space-pan' : '',
    spacePanDragging ? 'canvas-panel--space-pan-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={canvasPanelClass} onMouseUp={syncNodePositions}>
      {nodes.length === 0 && (
        <div className="canvas-canvas-empty" role="status">
          {t(labels, 'editor.canvasHint')}
        </div>
      )}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onMoveEnd={() => {
            if (spacePressedRef.current) setSpacePanDragging(false);
          }}
          onSelectionChange={onSelectionChangeGuarded}
          onNodeDoubleClick={readOnly ? undefined : onNodeDoubleClickHandler}
          onPaneClick={spacePressed ? undefined : onPaneClick}
          isValidConnection={readOnly ? () => false : isValidConnection}
          nodesDraggable={canEditCanvas}
          nodesConnectable={canEditCanvas}
          elementsSelectable={!spacePressed}
          selectionOnDrag={canEditCanvas}
          selectNodesOnDrag={canEditCanvas}
          panOnDrag={false}
          panActivationKeyCode="Space"
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Vertical}
          panOnScrollSpeed={0.5}
          zoomOnScroll={false}
          zoomActivationKeyCode="Control"
          zoomOnDoubleClick={false}
          multiSelectionKeyCode={null}
          selectionMode={SelectionMode.Partial}
          colorMode={isLight ? 'light' : 'dark'}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineComponent={WorkflowConnectionLine}
          edgesFocusable={canEditCanvas}
          edgesReconnectable={false}
          fitView={nodes.length > 0}
          fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FlowViewportCenterBridge onRegister={onRegisterFlowCenter} />
          <FocusNodeBridge definition={definition} focusNodeId={focusNodeId ?? null} />
          <CanvasViewportWheel />
          <Background gap={CANVAS_GRID_SIZE} size={1} color={gridColor} />
          <Controls onInteractiveChange={setCanvasInteractive} />
          <MiniMap zoomable pannable />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
