import type { WorkflowDefinition } from '../../api/client.js';
import type { LabelMap } from '../../i18n/labels.js';
import type { PinBranchDataMap } from './branch-path-utils.js';
import { firstEdgeOnPathToTarget } from './branch-path-utils.js';
import type { DataInspectorSource } from './data-inspector/types.js';
import type { NodeDebugState, PinDataMap, WorkflowItem } from './editor-debug-types.js';
import {
  getDirectMainFlowPredecessor,
  listMainFlowPredecessorNodes,
} from './main-flow-predecessors.js';
import { listSatelliteInvocations } from './node-debug-run-state.js';
import { resolvePredecessorItems } from './resolve-predecessor-items.js';

export const AGENT_TOOL_HUB_TYPES = new Set(['aiAgent', 'skillRun']);

export const AGENT_TOOL_SATELLITE_TYPES = new Set([
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

export const TOOL_INVOKE_SOURCE_ID = '__tool_invoke__';
export const MODEL_INVOKE_SOURCE_ID = '__model_invoke__';
export const OUTPUT_PARSER_INVOKE_SOURCE_ID = '__output_parser_invoke__';

export function isAgentToolSatelliteType(type: string): boolean {
  return AGENT_TOOL_SATELLITE_TYPES.has(type);
}

export function isAgentChatModelSatelliteType(type: string): boolean {
  return type === 'aiChatModel';
}

export function isAgentMemorySatelliteType(type: string): boolean {
  return type === 'aiMemory';
}

export function isAgentKnowledgeSatelliteType(type: string): boolean {
  return type === 'aiKnowledge';
}

export function isAgentOutputParserSatelliteType(type: string): boolean {
  return type === 'aiOutputParser';
}

export function findAgentHubSatellite(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
  toInput: string,
): { id: string; name: string; type: string } | null {
  for (const edge of definition.connections) {
    if (edge.from !== satelliteNodeId) continue;
    const edgeToInput = edge.toInput ?? 'main';
    if (edgeToInput !== toInput) continue;
    const hub = definition.nodes.find((n) => n.id === edge.to);
    if (!hub || !AGENT_TOOL_HUB_TYPES.has(hub.type)) continue;
    return { id: hub.id, name: hub.name.trim(), type: hub.type };
  }
  return null;
}

export function findAgentToolHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): { id: string; name: string; type: string } | null {
  return findAgentHubSatellite(definition, satelliteNodeId, 'ai_tool');
}

export function findAgentChatModelHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): { id: string; name: string; type: string } | null {
  return findAgentHubSatellite(definition, satelliteNodeId, 'ai_languageModel');
}

export function findAgentMemoryHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): { id: string; name: string; type: string } | null {
  return findAgentHubSatellite(definition, satelliteNodeId, 'ai_memory');
}

export function findAgentKnowledgeHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): { id: string; name: string; type: string } | null {
  return findAgentHubSatellite(definition, satelliteNodeId, 'ai_knowledge');
}

export function findAgentOutputParserHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): { id: string; name: string; type: string } | null {
  return findAgentHubSatellite(definition, satelliteNodeId, 'ai_outputParser');
}

function resolveHubNodeName(definition: WorkflowDefinition, hubId: string): string {
  return definition.nodes.find((n) => n.id === hubId)?.name.trim() ?? hubId;
}

function buildHubPredecessorSources(
  params: {
    definition: WorkflowDefinition;
    hubId: string;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  const {
    definition,
    hubId,
    pinData,
    pinBranchData = {},
    nodeDebug,
  } = params;
  const mainPredecessors = listMainFlowPredecessorNodes(definition, hubId);
  return mainPredecessors.map((pred) => {
    const edge = firstEdgeOnPathToTarget(definition, pred.id, hubId);
    const items = resolvePredecessorItems(
      pred.id,
      pinData,
      nodeDebug,
      edge?.fromOutput,
      pinBranchData,
      definition,
    );
    return {
      id: pred.id,
      label: pred.name,
      items,
      icon: 'node' as const,
    };
  });
}

function resolveDefaultHubSatelliteSourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
  invokeSourceId: string,
): string {
  if (sources.some((s) => s.id === invokeSourceId && s.items.length > 0)) {
    return invokeSourceId;
  }
  const predecessorIds = new Set(
    sources.filter((s) => s.icon === 'node').map((s) => s.id),
  );
  const direct = getDirectMainFlowPredecessor(definition, hubId);
  if (direct && predecessorIds.has(direct.id)) return direct.id;
  const mainPreds = listMainFlowPredecessorNodes(definition, hubId);
  const lastMain = mainPreds[mainPreds.length - 1];
  if (lastMain && predecessorIds.has(lastMain.id)) return lastMain.id;
  return sources.find((s) => s.icon === 'node')?.id ?? invokeSourceId;
}

function toolInvokeItems(debug?: NodeDebugState): WorkflowItem[] {
  const invocations = listSatelliteInvocations(debug);
  if (!invocations.length) return [];
  return invocations.map((inv, index) => {
    const input = inv.input;
    const json =
      input != null && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : { arguments: input, ...(invocations.length > 1 ? { round: index + 1 } : {}) };
    return { json };
  });
}

function normalizePromptMessageRoles(messages: unknown): unknown {
  if (!Array.isArray(messages)) return messages;
  return messages.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const row = entry as Record<string, unknown>;
    if (typeof row.role !== 'string') return entry;
    const role = row.role.trim().toLowerCase();
    let normalized = row.role;
    if (role === 'human' || role === 'humanmessage') normalized = 'user';
    else if (role === 'ai' || role === 'aimessage') normalized = 'assistant';
    else if (role === 'tool' || role === 'toolmessage') normalized = 'tool';
    return normalized === row.role ? entry : { ...row, role: normalized };
  });
}

function modelInvokeItems(debug?: NodeDebugState): WorkflowItem[] {
  const invocations = listSatelliteInvocations(debug);
  if (!invocations.length) return [];
  return invocations.map((inv, index) => {
    const messages = normalizePromptMessageRoles(inv.input);
    const json =
      invocations.length > 1
        ? { round: index + 1, messages }
        : { messages };
    return { json };
  });
}

export function hasToolInvokeData(debug?: NodeDebugState): boolean {
  return toolInvokeItems(debug).length > 0;
}

export function hasModelInvokeData(debug?: NodeDebugState): boolean {
  return modelInvokeItems(debug).length > 0;
}

function parserInvokeItems(debug?: NodeDebugState): WorkflowItem[] {
  const fromStream: WorkflowItem[] = [];
  for (const entry of debug?.agentStream ?? []) {
    if (entry.type === 'satellite_schema_read' && entry.schema !== undefined) {
      fromStream.push({ json: { schema: entry.schema } });
    }
  }
  if (fromStream.length > 0) return fromStream;
  return (debug?.outputItems?.[0] ?? [])
    .filter((row) => row.json.schema !== undefined)
    .map((row) => ({ json: { schema: row.json.schema } }));
}

export function hasParserInvokeData(debug?: NodeDebugState): boolean {
  return parserInvokeItems(debug).length > 0;
}

export function resolveParserInvokePreview(debug?: NodeDebugState): unknown | null {
  const items = parserInvokeItems(debug);
  if (!items.length) return null;
  if (items.length === 1) return items[0]?.json ?? null;
  return items.map((item, index) => ({
    round: index + 1,
    ...item.json,
  }));
}

export function buildAgentToolInputSources(
  params: {
    definition: WorkflowDefinition;
    toolNodeId: string;
    hubId: string;
    labels: LabelMap;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  const { toolNodeId, ...hubParams } = params;
  const predecessorSources = buildHubPredecessorSources(hubParams);
  const invokeItems = toolInvokeItems(params.nodeDebug[toolNodeId]);
  const invokeSource: DataInspectorSource = {
    id: TOOL_INVOKE_SOURCE_ID,
    label: resolveHubNodeName(params.definition, params.hubId),
    items: invokeItems,
    icon: 'branch',
  };
  return [...predecessorSources, invokeSource];
}

export function buildAgentChatModelInputSources(
  params: {
    definition: WorkflowDefinition;
    modelNodeId: string;
    hubId: string;
    labels: LabelMap;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  const { modelNodeId, ...hubParams } = params;
  const predecessorSources = buildHubPredecessorSources(hubParams);
  const invokeItems = modelInvokeItems(params.nodeDebug[modelNodeId]);
  const invokeSource: DataInspectorSource = {
    id: MODEL_INVOKE_SOURCE_ID,
    label: resolveHubNodeName(params.definition, params.hubId),
    items: invokeItems,
    icon: 'branch',
  };
  return [...predecessorSources, invokeSource];
}

export function buildAgentMemoryInputSources(
  params: {
    definition: WorkflowDefinition;
    memoryNodeId: string;
    hubId: string;
    labels: LabelMap;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  return buildHubPredecessorSources(params);
}

export function buildAgentKnowledgeInputSources(
  params: {
    definition: WorkflowDefinition;
    knowledgeNodeId: string;
    hubId: string;
    labels: LabelMap;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  return buildHubPredecessorSources(params);
}

export function resolveDefaultAgentMemorySourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
): string {
  const predecessorIds = new Set(
    sources.filter((s) => s.icon === 'node').map((s) => s.id),
  );
  const direct = getDirectMainFlowPredecessor(definition, hubId);
  if (direct && predecessorIds.has(direct.id)) return direct.id;
  const mainPreds = listMainFlowPredecessorNodes(definition, hubId);
  const lastMain = mainPreds[mainPreds.length - 1];
  if (lastMain && predecessorIds.has(lastMain.id)) return lastMain.id;
  return sources.find((s) => s.icon === 'node')?.id ?? '';
}

export function resolveDefaultAgentKnowledgeSourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
): string {
  const predecessorIds = new Set(
    sources.filter((s) => s.icon === 'node').map((s) => s.id),
  );
  const direct = getDirectMainFlowPredecessor(definition, hubId);
  if (direct && predecessorIds.has(direct.id)) return direct.id;
  const mainPreds = listMainFlowPredecessorNodes(definition, hubId);
  const lastMain = mainPreds[mainPreds.length - 1];
  if (lastMain && predecessorIds.has(lastMain.id)) return lastMain.id;
  return sources.find((s) => s.icon === 'node')?.id ?? '';
}

export function resolveDefaultAgentToolSourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
): string {
  return resolveDefaultHubSatelliteSourceId(sources, definition, hubId, TOOL_INVOKE_SOURCE_ID);
}

export function resolveDefaultAgentChatModelSourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
): string {
  return resolveDefaultHubSatelliteSourceId(sources, definition, hubId, MODEL_INVOKE_SOURCE_ID);
}

export function buildAgentOutputParserInputSources(
  params: {
    definition: WorkflowDefinition;
    parserNodeId: string;
    hubId: string;
    labels: LabelMap;
    pinData: PinDataMap;
    pinBranchData?: PinBranchDataMap;
    nodeDebug: Record<string, NodeDebugState>;
  },
): DataInspectorSource[] {
  const { parserNodeId, ...hubParams } = params;
  const predecessorSources = buildHubPredecessorSources(hubParams);
  const invokeItems = parserInvokeItems(params.nodeDebug[parserNodeId]);
  const invokeSource: DataInspectorSource = {
    id: OUTPUT_PARSER_INVOKE_SOURCE_ID,
    label: resolveHubNodeName(params.definition, params.hubId),
    items: invokeItems,
    icon: 'branch',
  };
  return [...predecessorSources, invokeSource];
}

export function resolveDefaultAgentOutputParserSourceId(
  sources: DataInspectorSource[],
  definition: WorkflowDefinition,
  hubId: string,
): string {
  return resolveDefaultHubSatelliteSourceId(
    sources,
    definition,
    hubId,
    OUTPUT_PARSER_INVOKE_SOURCE_ID,
  );
}
