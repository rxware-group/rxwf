import type { WorkflowDefinition } from '../../api/client.js';
import type { LoopIterationRecord, NodeDebugState, WorkflowItem } from './editor-debug-types.js';

export type SatelliteInvocationRecord = {
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
};

/** Reconstruct satellite LLM/tool invocation timeline from outputItems or agentStream. */
export function listSatelliteInvocations(debug?: NodeDebugState): SatelliteInvocationRecord[] {
  if (!debug) return [];
  const fromItems = debug.outputItems?.[0] ?? [];
  if (fromItems.length > 0) {
    return fromItems.map((item) => ({
      input: item.json.input,
      output: item.json.output,
      error: typeof item.json.error === 'string' ? item.json.error : undefined,
      durationMs:
        typeof item.json.durationMs === 'number' ? item.json.durationMs : undefined,
    }));
  }
  const invocations: SatelliteInvocationRecord[] = [];
  const openStarts: unknown[] = [];
  for (const entry of debug.agentStream ?? []) {
    if (entry.type === 'satellite_invoke_start') {
      openStarts.push(entry.input);
    } else if (entry.type === 'satellite_invoke_end') {
      invocations.push({
        input: openStarts.shift(),
        output: entry.output,
        error: entry.error,
        durationMs: entry.durationMs,
      });
    }
  }
  return invocations;
}

export function satelliteInvocationsToOutputItems(
  debug?: NodeDebugState,
): WorkflowItem[] {
  return listSatelliteInvocations(debug).map((inv) => ({
    json: {
      input: inv.input,
      output: inv.output,
      ...(inv.error ? { error: inv.error } : {}),
      ...(inv.durationMs != null ? { durationMs: inv.durationMs } : {}),
    },
  }));
}

const AGENT_HUB_TYPES = new Set(['aiAgent', 'skillRun']);

function listHubSatelliteNodeIds(
  definition: WorkflowDefinition,
  hubNodeId: string,
): string[] {
  const ids: string[] = [];
  for (const c of definition.connections) {
    if (c.to !== hubNodeId) continue;
    const input = c.toInput ?? 'main';
    if (input.startsWith('ai_')) ids.push(c.from);
  }
  return ids;
}

/** Clear stale satellite debug badges when an agent hub starts a new debug run. */
export function clearSatelliteDebugForHubRun(
  nodeDebug: Record<string, NodeDebugState>,
  definition: WorkflowDefinition,
  hubNodeId: string,
): Record<string, NodeDebugState> {
  const hub = definition.nodes.find((n) => n.id === hubNodeId);
  if (!hub || !AGENT_HUB_TYPES.has(hub.type)) return nodeDebug;
  const next = { ...nodeDebug };
  for (const id of listHubSatelliteNodeIds(definition, hubNodeId)) {
    delete next[id];
  }
  return next;
}

export function countSatelliteSchemaReads(debug?: NodeDebugState): number {
  return (
    debug?.agentStream?.filter((entry) => entry.type === 'satellite_schema_read').length ?? 0
  );
}

/** How many LLM/tool satellite invocations were recorded for canvas badges. */
export function countSatelliteInvocations(debug?: NodeDebugState): number {
  if (!debug) return 0;
  const schemaReads = countSatelliteSchemaReads(debug);
  if (schemaReads > 0) return schemaReads;
  const fromItems = debug.outputItems?.[0]?.length ?? 0;
  if (fromItems > 0) return fromItems;
  const ends =
    debug.agentStream?.filter((entry) => entry.type === 'satellite_invoke_end').length ?? 0;
  if (ends > 0) return ends;
  return (
    debug.agentStream?.filter((entry) => entry.type === 'satellite_invoke_start').length ?? 0
  );
}

function countSatelliteStreamStarts(debug?: NodeDebugState): number {
  return (
    debug?.agentStream?.filter((entry) => entry.type === 'satellite_invoke_start').length ?? 0
  );
}

function countSatelliteStreamEnds(debug?: NodeDebugState): number {
  return (
    debug?.agentStream?.filter((entry) => entry.type === 'satellite_invoke_end').length ?? 0
  );
}

export type HubAgentSyncPayload = {
  answer?: string;
  parsed?: unknown;
  /** Assistant texts from each LLM round-trip (agent transcript order). */
  llmResponses?: string[];
};

/** Collect per-item LLM answers from a hub agent output branch. */
export function buildLlmResponsesFromHubOutputItems(
  items: WorkflowItem[] | undefined,
): string[] {
  if (!items?.length) return [];
  const multiItem = items.length > 1;
  return items.flatMap((item) => {
    const json = item.json;
    const answer = json.answer;
    if (multiItem && typeof answer === 'string' && answer.trim().length > 0) {
      return [answer];
    }
    const fromField = json.llmResponses;
    if (Array.isArray(fromField) && fromField.length > 0) {
      return fromField.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );
    }
    if (typeof answer === 'string' && answer.trim().length > 0) {
      return [answer];
    }
    return [];
  });
}

export function buildHubAgentSyncPayloadFromOutputItems(
  outputItems: WorkflowItem[][] | undefined,
): HubAgentSyncPayload {
  const branch = outputItems?.[0] ?? [];
  const llmResponses = buildLlmResponsesFromHubOutputItems(branch);
  const lastJson = branch[branch.length - 1]?.json;
  return {
    answer: typeof lastJson?.answer === 'string' ? lastJson.answer : undefined,
    parsed: lastJson?.parsed,
    llmResponses,
  };
}

function invocationMissingLlmOutput(output: unknown): boolean {
  if (output === undefined) return true;
  if (output == null) return true;
  if (typeof output === 'object' && 'content' in output) {
    const content = (output as { content?: unknown }).content;
    if (typeof content === 'string') return content.trim().length === 0;
  }
  return false;
}

/** Backfill Chat Model satellite invocations that ended with duration only. */
export function backfillChatModelInvocationOutputs(
  debug: NodeDebugState,
  responses: string[],
): NodeDebugState {
  const texts = responses.map((text) => (text.trim().length > 0 ? text : ''));
  if (!texts.some((text) => text.length > 0)) return debug;

  let changed = false;
  const outputItems = debug.outputItems?.map((branch, branchIndex) => {
    if (branchIndex !== 0) return branch;
    return branch.map((item, invocationIndex) => {
      if (!invocationMissingLlmOutput(item.json.output)) return item;
      const text = texts[invocationIndex];
      if (!text?.trim()) return item;
      changed = true;
      return {
        json: {
          ...item.json,
          output: { content: text },
        },
      };
    });
  });

  let endOrdinal = 0;
  const agentStream = debug.agentStream?.map((entry) => {
    if (entry.type !== 'satellite_invoke_end' || entry.error) return entry;
    const invocationIndex = endOrdinal;
    endOrdinal += 1;
    if (!invocationMissingLlmOutput(entry.output)) return entry;
    const text = texts[invocationIndex];
    if (!text?.trim()) return entry;
    changed = true;
    return { ...entry, output: { content: text } };
  });

  if (!changed) return debug;
  return {
    ...debug,
    ...(outputItems ? { outputItems } : {}),
    ...(agentStream ? { agentStream } : {}),
  };
}

function bootstrapOutputParserDebug(
  nodeDebug: Record<string, NodeDebugState>,
  parserNode: WorkflowDefinition['nodes'][number],
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  return applyAgentOrSatelliteStream(
    nodeDebug,
    parserNode.id,
    {
      type: 'satellite_schema_read',
      schema: parserNode.parameters.jsonSchema,
    },
    runMeta,
  );
}

/** When a hub agent finishes, close open satellite invocations and backfill LLM output. */
export function syncHubSatellitesOnAgentSuccess(
  nodeDebug: Record<string, NodeDebugState>,
  definition: WorkflowDefinition,
  hubNodeId: string,
  hubResult?: HubAgentSyncPayload,
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  const hub = definition.nodes.find((n) => n.id === hubNodeId);
  if (!hub || !AGENT_HUB_TYPES.has(hub.type)) return nodeDebug;
  const llmResponses = hubResult?.llmResponses ?? [];
  let next = nodeDebug;
  for (const id of listHubSatelliteNodeIds(definition, hubNodeId)) {
    const satelliteNode = definition.nodes.find((n) => n.id === id);
    const prev = next[id];

    if (!prev && satelliteNode?.type === 'aiOutputParser') {
      next = bootstrapOutputParserDebug(next, satelliteNode, runMeta);
      continue;
    }

    if (!prev) continue;

    let working = next;
    const missingEnds = countSatelliteStreamStarts(prev) - countSatelliteStreamEnds(prev);
    const existingEnds = countSatelliteStreamEnds(prev);
    for (let i = 0; i < missingEnds; i++) {
      const responseText = llmResponses[existingEnds + i];
      working = applyAgentOrSatelliteStream(
        working,
        id,
        {
          type: 'satellite_invoke_end',
          output: responseText ? { content: responseText } : undefined,
          durationMs: 0,
        },
        runMeta,
      );
    }

    let updated = working[id];
    if (!updated) continue;
    if (satelliteNode?.type === 'aiChatModel') {
      const backfilled = backfillChatModelInvocationOutputs(updated, llmResponses);
      if (backfilled !== updated) {
        working = { ...working, [id]: backfilled };
        updated = backfilled;
      }
    }
    if (updated.status === 'running' || missingEnds > 0) {
      const invokeCount = countSatelliteInvocations(updated);
      const outputItems =
        updated.outputItems?.[0]?.length
          ? updated.outputItems
          : (() => {
              const items = satelliteInvocationsToOutputItems(updated);
              return items.length ? [items] : undefined;
            })();
      working = {
        ...working,
        [id]: {
          ...updated,
          status: 'success',
          itemCount: invokeCount > 0 ? invokeCount : 1,
          ...(outputItems ? { outputItems } : {}),
        },
      };
    }
    next = working;
  }
  return next;
}

/** When a hub agent fails, close open satellite invocations and preserve captured I/O. */
export function syncHubSatellitesOnAgentFailure(
  nodeDebug: Record<string, NodeDebugState>,
  definition: WorkflowDefinition,
  hubNodeId: string,
  errorMessage?: string,
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  const hub = definition.nodes.find((n) => n.id === hubNodeId);
  if (!hub || !AGENT_HUB_TYPES.has(hub.type)) return nodeDebug;
  let next = nodeDebug;
  for (const id of listHubSatelliteNodeIds(definition, hubNodeId)) {
    const prev = next[id];
    if (!prev) continue;
    let working = next;
    const missingEnds = countSatelliteStreamStarts(prev) - countSatelliteStreamEnds(prev);
    for (let i = 0; i < missingEnds; i++) {
      working = applyAgentOrSatelliteStream(
        working,
        id,
        {
          type: 'satellite_invoke_end',
          error: errorMessage,
          durationMs: 0,
        },
        runMeta,
      );
    }
    const updated = working[id];
    if (!updated) continue;
    if (updated.status === 'running' || missingEnds > 0) {
      const invokeCount = countSatelliteInvocations(updated);
      const outputItems =
        updated.outputItems?.[0]?.length
          ? updated.outputItems
          : (() => {
              const items = satelliteInvocationsToOutputItems(updated);
              return items.length ? [items] : undefined;
            })();
      working = {
        ...working,
        [id]: {
          ...updated,
          status: 'failed',
          errorMessage: errorMessage ?? updated.errorMessage,
          itemCount: invokeCount > 0 ? invokeCount : updated.itemCount,
          ...(outputItems ? { outputItems } : {}),
        },
      };
    }
    next = working;
  }
  return next;
}

/** @deprecated Use syncHubSatellitesOnAgentSuccess */
export function finalizeRunningSatellitesForHub(
  nodeDebug: Record<string, NodeDebugState>,
  definition: WorkflowDefinition,
  hubNodeId: string,
): Record<string, NodeDebugState> {
  return syncHubSatellitesOnAgentSuccess(nodeDebug, definition, hubNodeId);
}

export type DebugNodeResultPayload = {
  status: 'success' | 'failed' | 'skipped' | 'waiting';
  runId?: string;
  runSeq?: number;
  itemCount?: number;
  errorMessage?: string;
  errorCode?: string;
  durationMs?: number;
  outputItems?: NodeDebugState['outputItems'];
  logs?: NodeDebugState['logs'];
  agentStream?: NodeDebugState['agentStream'];
  loopIteration?: {
    round: number;
    totalRounds: number;
    inputItems: WorkflowItem[];
  };
  loopIterationCount?: number;
  loopBatchItemCount?: number;
  inputItems?: WorkflowItem[];
};

/** Append a live agent stream chunk while a node is still running. */
export function appendAgentStreamChunk(
  nodeDebug: Record<string, NodeDebugState>,
  nodeId: string,
  chunk: NonNullable<NodeDebugState['agentStream']>[number],
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  const prev = nodeDebug[nodeId];
  return {
    ...nodeDebug,
    [nodeId]: {
      ...prev,
      status: 'running',
      runId: runMeta?.runId ?? prev?.runId,
      runSeq: runMeta?.runSeq ?? prev?.runSeq,
      agentStream: [...(prev?.agentStream ?? []), chunk],
    },
  };
}

/** Match the next satellite_invoke_end to the earliest still-open invoke start (FIFO). */
export function resolveSatelliteInvokeInput(
  stream: NodeDebugState['agentStream'] | undefined,
): unknown {
  if (!stream?.length) return undefined;
  const openStarts: unknown[] = [];
  for (const entry of stream) {
    if (entry?.type === 'satellite_invoke_start') {
      openStarts.push(entry.input);
    } else if (entry?.type === 'satellite_invoke_end') {
      openStarts.shift();
    }
  }
  return openStarts.length ? openStarts[0] : undefined;
}

/** Route agent stream chunks to parent or satellite nodes; record satellite output timeline. */
export function applyAgentOrSatelliteStream(
  nodeDebug: Record<string, NodeDebugState>,
  nodeId: string,
  chunk: NonNullable<NodeDebugState['agentStream']>[number],
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  if (chunk.type === 'satellite_schema_read') {
    const prev = nodeDebug[nodeId];
    const schema = chunk.schema;
    return {
      ...nodeDebug,
      [nodeId]: {
        ...prev,
        status: 'success',
        runId: runMeta?.runId ?? prev?.runId,
        runSeq: runMeta?.runSeq ?? prev?.runSeq,
        agentStream: [...(prev?.agentStream ?? []), chunk],
        outputItems: [[{ json: { schema } }]],
        itemCount: (prev?.itemCount ?? 0) + 1,
      },
    };
  }

  if (chunk.type === 'satellite_memory_snapshot') {
    const prev = nodeDebug[nodeId];
    const sessionId = chunk.sessionId;
    const messages = chunk.messages ?? [];
    return {
      ...nodeDebug,
      [nodeId]: {
        ...prev,
        status: 'success',
        runId: runMeta?.runId ?? prev?.runId,
        runSeq: runMeta?.runSeq ?? prev?.runSeq,
        agentStream: [...(prev?.agentStream ?? []), chunk],
        outputItems: [[{ json: { sessionId, messages } }]],
        itemCount: 1,
      },
    };
  }

  if (chunk.type === 'satellite_knowledge_query') {
    const prev = nodeDebug[nodeId];
    const prevItems = prev?.outputItems?.[0] ?? [];
    const queryResult = {
      query: chunk.query ?? '',
      knowledgeBaseIds: chunk.knowledgeBaseIds ?? [],
      chunks: chunk.chunks ?? [],
    };
    return {
      ...nodeDebug,
      [nodeId]: {
        ...prev,
        status: 'success',
        runId: runMeta?.runId ?? prev?.runId,
        runSeq: runMeta?.runSeq ?? prev?.runSeq,
        agentStream: [...(prev?.agentStream ?? []), chunk],
        outputItems: [[...prevItems, { json: queryResult }]],
        itemCount: prevItems.length + 1,
      },
    };
  }

  if (chunk.type === 'satellite_invoke_start') {
    const prev = nodeDebug[nodeId];
    return {
      ...nodeDebug,
      [nodeId]: {
        ...prev,
        status: 'running',
        runId: runMeta?.runId ?? prev?.runId,
        runSeq: runMeta?.runSeq ?? prev?.runSeq,
        agentStream: [...(prev?.agentStream ?? []), chunk],
      },
    };
  }

  if (chunk.type === 'satellite_invoke_end') {
    const prev = nodeDebug[nodeId];
    const prevItems = prev?.outputItems?.[0] ?? [];
    const invocation = {
      json: {
        input: resolveSatelliteInvokeInput(prev?.agentStream),
        output: chunk.output,
        error: chunk.error,
        durationMs: chunk.durationMs,
      },
    };
    return {
      ...nodeDebug,
      [nodeId]: {
        ...prev,
        status: chunk.error ? 'failed' : 'success',
        errorMessage: chunk.error,
        runId: runMeta?.runId ?? prev?.runId,
        runSeq: runMeta?.runSeq ?? prev?.runSeq,
        agentStream: [...(prev?.agentStream ?? []), chunk],
        outputItems: [[...prevItems, invocation]],
        itemCount: prevItems.length + 1,
      },
    };
  }

  return appendAgentStreamChunk(nodeDebug, nodeId, chunk, runMeta);
}

/** Mark a node as running when debug SSE reports node start. */
export function markDebugNodeStarted(
  nodeDebug: Record<string, NodeDebugState>,
  nodeId: string,
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  return {
    ...nodeDebug,
    [nodeId]: {
      ...nodeDebug[nodeId],
      status: 'running',
      runId: runMeta?.runId ?? nodeDebug[nodeId]?.runId,
      runSeq: runMeta?.runSeq ?? nodeDebug[nodeId]?.runSeq,
    },
  };
}

/** 单节点调试开始时仅标记目标节点为 running，不覆盖上游已有状态。 */
export function markPartialRunStarted(
  nodeDebug: Record<string, NodeDebugState>,
  targetNodeId: string,
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  return {
    ...nodeDebug,
    [targetNodeId]: { status: 'running', runId: runMeta?.runId, runSeq: runMeta?.runSeq },
  };
}

/** Webhook 监听测试：等待外部 POST 到测试 URL。 */
export function markDebugNodeWaiting(
  nodeDebug: Record<string, NodeDebugState>,
  targetNodeId: string,
  runMeta?: Pick<NodeDebugState, 'runId' | 'runSeq'>,
): Record<string, NodeDebugState> {
  return {
    ...nodeDebug,
    [targetNodeId]: { status: 'waiting', runId: runMeta?.runId, runSeq: runMeta?.runSeq },
  };
}

export function snapshotNodeDebug(
  nodeDebug: Record<string, NodeDebugState>,
  nodeIds: string[],
): Record<string, NodeDebugState | undefined> {
  const snap: Record<string, NodeDebugState | undefined> = {};
  for (const id of nodeIds) {
    snap[id] = nodeDebug[id];
  }
  return snap;
}

function pickRicherAgentStream(
  prev?: NodeDebugState['agentStream'],
  incoming?: NodeDebugState['agentStream'],
): NodeDebugState['agentStream'] | undefined {
  const lenPrev = prev?.length ?? 0;
  const lenIncoming = incoming?.length ?? 0;
  if (lenPrev === 0 && lenIncoming === 0) return undefined;
  return lenPrev >= lenIncoming ? prev : incoming;
}

/** Per-round records for nodes executed inside a Loop body. */
export function listLoopIterations(debug?: NodeDebugState): LoopIterationRecord[] {
  if (!debug?.loopIterations?.length) return [];
  return [...debug.loopIterations].sort((a, b) => a.round - b.round);
}

function mergeLoopIterationRecords(
  prev: LoopIterationRecord[] | undefined,
  incoming: NonNullable<DebugNodeResultPayload['loopIteration']>,
  result: DebugNodeResultPayload,
): LoopIterationRecord[] {
  const record: LoopIterationRecord = {
    round: incoming.round,
    inputItems: incoming.inputItems,
    outputItems: result.outputItems,
    durationMs: result.durationMs,
    logs: result.logs,
  };
  const existing = prev ?? [];
  const idx = existing.findIndex((item) => item.round === incoming.round);
  if (idx >= 0) {
    return existing.map((item, i) => (i === idx ? record : item));
  }
  return [...existing, record].sort((a, b) => a.round - b.round);
}

export function applyNodeDebugResults(
  nodeDebug: Record<string, NodeDebugState>,
  nodeResults: Record<string, DebugNodeResultPayload>,
): Record<string, NodeDebugState> {
  const next = { ...nodeDebug };
  for (const [id, r] of Object.entries(nodeResults)) {
    if (r.status === 'skipped') {
      delete next[id];
      continue;
    }
    const prev = next[id];
    const loopIterations = r.loopIteration
      ? mergeLoopIterationRecords(prev?.loopIterations, r.loopIteration, r)
      : prev?.loopIterations;
    const mergedLogs =
      loopIterations?.flatMap((iter) => iter.logs ?? []) ??
      r.logs ??
      prev?.logs;
    const totalDurationMs =
      loopIterations?.reduce((sum, iter) => sum + (iter.durationMs ?? 0), 0) ??
      r.durationMs ??
      prev?.durationMs;
    const lastIteration = loopIterations?.[loopIterations.length - 1];
    next[id] = {
      status:
        r.status === 'success'
          ? 'success'
          : r.status === 'waiting'
            ? 'waiting'
            : 'failed',
      runId: r.runId ?? prev?.runId,
      runSeq: r.runSeq ?? prev?.runSeq,
      itemCount: r.itemCount ?? prev?.itemCount,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
      durationMs: totalDurationMs,
      outputItems: r.outputItems ?? prev?.outputItems,
      inputPreview:
        r.inputItems ?? lastIteration?.inputItems ?? prev?.inputPreview,
      logs: mergedLogs,
      agentStream: pickRicherAgentStream(prev?.agentStream, r.agentStream),
      loopIterations,
      loopIterationCount: r.loopIterationCount ?? prev?.loopIterationCount,
      loopBatchItemCount: r.loopBatchItemCount ?? prev?.loopBatchItemCount,
    };
  }
  return next;
}

/**
 * 部分执行异常后的恢复：仅对仍在 running 的目标节点记 failed；
 * 已 skipped（从 debug 移除）或已有 success/failed 结果的节点保持/恢复为未执行或原状态。
 */
export function finalizeFailedRunNodes(
  nodeDebug: Record<string, NodeDebugState>,
  runNodeIds: string[],
  targetNodeId: string,
  prior: Record<string, NodeDebugState | undefined>,
  errorMessage: string,
): Record<string, NodeDebugState> {
  const next = { ...nodeDebug };
  for (const id of runNodeIds) {
    const current = next[id];
    if (id === targetNodeId) {
      if (current?.status === 'running') {
        next[id] = { status: 'failed', errorMessage };
      } else if (!current) {
        const previous = prior[id];
        if (previous) next[id] = previous;
        else delete next[id];
      }
      continue;
    }
    if (current?.status !== 'running') continue;
    const previous = prior[id];
    if (previous) next[id] = previous;
    else delete next[id];
  }
  return next;
}
