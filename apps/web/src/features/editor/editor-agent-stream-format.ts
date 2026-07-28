import { formatCrewDecision } from '../executions/execution-timeline-steps.js';
import { isSatelliteNodeType } from './main-flow-predecessors.js';
import { t, type LabelMap } from '../../i18n/labels.js';
import type { AgentStreamLogEntry, NodeDebugState } from './editor-debug-types.js';
import { formatKnowledgeRetrievalDetail } from './knowledge-output.js';
import { listSatelliteInvocations } from './node-debug-run-state.js';

export type AgentStreamFormatContext = {
  nodeType?: string;
  nodeName?: string;
};

function formatStreamDetail(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function formatLlmInvokeOutput(value: unknown): string {
  if (value != null && typeof value === 'object' && 'content' in value) {
    const content = (value as { content?: unknown }).content;
    if (typeof content === 'string') return content;
  }
  return formatStreamDetail(value);
}

/** Backfill missing satellite_invoke_end output from recorded invocations. */
export function enrichSatelliteAgentStreamForDisplay(
  entries: AgentStreamLogEntry[],
  debug?: NodeDebugState,
): AgentStreamLogEntry[] {
  const invocations = listSatelliteInvocations(debug);
  let endIndex = 0;
  return entries.map((entry) => {
    if (entry.type !== 'satellite_invoke_end') return entry;
    const inv = invocations[endIndex];
    endIndex += 1;
    const output = entry.output !== undefined ? entry.output : inv?.output;
    const error = entry.error ?? inv?.error;
    if (output === entry.output && error === entry.error) return entry;
    return { ...entry, output, error };
  });
}

function formatAgentStepPayload(
  labels: LabelMap,
  step: unknown,
): { label: string; detail?: string } | null {
  if (!step || typeof step !== 'object') return null;
  const o = step as Record<string, unknown>;

  if (o.kind === 'chatModel') {
    const name = String(o.satelliteNodeName ?? o.satelliteNodeId ?? 'Chat Model');
    if (o.phase === 'start') {
      return {
        label: t(labels, 'editor.chatModelInvokeStart', { name }),
        detail: o.input !== undefined ? formatStreamDetail(o.input) : undefined,
      };
    }
    if (o.error) {
      return {
        label: t(labels, 'editor.chatModelInvokeFailed', { name }),
        detail: String(o.error),
      };
    }
    const ms =
      o.durationMs != null
        ? t(labels, 'editor.chatModelInvokeDuration', { name, ms: String(o.durationMs) })
        : t(labels, 'editor.chatModelInvokeEnd', { name });
    return {
      label: ms,
      detail: o.output !== undefined ? formatLlmInvokeOutput(o.output) : undefined,
    };
  }

  if (o.kind === 'outputParser') {
    const name = String(o.satelliteNodeName ?? o.satelliteNodeId ?? 'Output Parser');
    return {
      label: t(labels, 'editor.outputParserSchemaRead', { name }),
      detail: o.schema !== undefined ? formatStreamDetail(o.schema) : undefined,
    };
  }

  if (o.kind === 'knowledge') {
    const chunks = Array.isArray(o.chunks)
      ? (o.chunks as Array<{ text: string; score: number; documentName: string; documentId: string }>)
      : undefined;
    const count = chunks?.length ?? Number(o.chunkCount ?? 0);
    return {
      label: t(labels, 'editor.satelliteKnowledgeQuery', { count: String(count) }),
      detail: formatKnowledgeRetrievalDetail(
        o.query != null ? String(o.query) : undefined,
        chunks,
      ),
    };
  }

  if (o.kind === 'agentItemStart') {
    const itemIndex = Number(o.itemIndex ?? 1);
    const itemCount = Number(o.itemCount ?? 1);
    return {
      label:
        itemCount > 1
          ? t(labels, 'editor.agentItemStart', {
              index: String(itemIndex),
              count: String(itemCount),
            })
          : t(labels, 'editor.agentRunStart'),
      detail: o.userMessage != null ? formatStreamDetail(o.userMessage) : undefined,
    };
  }

  if (o.kind === 'subagentRunStart') {
    return {
      label: t(labels, 'editor.subagentRunStart'),
      detail: o.userMessage != null ? formatStreamDetail(o.userMessage) : undefined,
    };
  }

  if (o.kind === 'subagentRunEnd') {
    return {
      label: t(labels, 'editor.subagentRunEnd'),
      detail: o.answer != null ? formatStreamDetail(o.answer) : undefined,
    };
  }

  if (o.kind === 'subagentSatellite') {
    const name = String(o.satelliteNodeName ?? o.satelliteNodeId ?? 'Satellite');
    if (o.phase === 'start') {
      return {
        label: t(labels, 'editor.subagentSatelliteStart', { name }),
        detail: o.input !== undefined ? formatStreamDetail(o.input) : undefined,
      };
    }
    if (o.phase === 'schema') {
      return {
        label: t(labels, 'editor.subagentSatelliteSchema', { name }),
        detail: o.schema !== undefined ? formatStreamDetail(o.schema) : undefined,
      };
    }
    if (o.phase === 'knowledge') {
      const chunks = Array.isArray(o.chunks)
        ? (o.chunks as Array<{ text: string; score: number; documentName: string; documentId: string }>)
        : undefined;
      const count = chunks?.length ?? Number(o.chunkCount ?? 0);
      return {
        label: t(labels, 'editor.subagentSatelliteKnowledge', { name, count: String(count) }),
        detail: formatKnowledgeRetrievalDetail(
          o.query != null ? String(o.query) : undefined,
          chunks,
        ),
      };
    }
    if (o.phase === 'memory') {
      const count = Number(o.messageCount ?? 0);
      return {
        label: t(labels, 'editor.subagentSatelliteMemory', { name, count: String(count) }),
        detail: o.sessionId != null ? String(o.sessionId) : undefined,
      };
    }
    if (o.error) {
      return {
        label: t(labels, 'editor.subagentSatelliteFailed', { name }),
        detail: String(o.error),
      };
    }
    const ms =
      o.durationMs != null
        ? t(labels, 'editor.subagentSatelliteDuration', { name, ms: String(o.durationMs) })
        : t(labels, 'editor.subagentSatelliteEnd', { name });
    return {
      label: ms,
      detail: o.output !== undefined ? formatLlmInvokeOutput(o.output) : undefined,
    };
  }

  if (o.kind === 'structuredOutputFailed') {
    return {
      label: t(labels, 'editor.structuredOutputFailed', {
        code: String(o.errorCode ?? 'E3013'),
      }),
      detail: formatStreamDetail({
        itemIndex: o.itemIndex,
        itemCount: o.itemCount,
        userMessage: o.userMessage,
        systemMessage: o.systemMessage,
        answer: o.answer,
        outputSchema: o.outputSchema,
        error: o.error,
      }),
    };
  }

  if (o.crewManager != null || o.supervisor != null) {
    const who = String(o.crewManager ?? o.supervisor ?? t(labels, 'auto.t_eefdd05b'));
    const round =
      o.round != null
        ? t(labels, 'timeline.round', { n: String(Number(o.round) + 1) })
        : o.stepIndex != null
          ? t(labels, 'timeline.step', { n: String(Number(o.stepIndex) + 1) })
          : undefined;
    return {
      label: [who, formatCrewDecision(labels, o.decision), round].filter(Boolean).join(' · '),
    };
  }

  if (o.crewMember != null) {
    const name = String(o.crewMember);
    const status = String(o.status ?? 'success');
    const task = o.task != null ? String(o.task) : undefined;
    if (status === 'running') {
      return {
        label: t(labels, 'timeline.running', { name }),
        detail: task ? formatStreamDetail(task) : undefined,
      };
    }
    return {
      label:
        status === 'success'
          ? t(labels, 'timeline.done', { name })
          : t(labels, 'timeline.failed', { name, status }),
      detail:
        o.output != null
          ? formatStreamDetail(o.output)
          : task
            ? formatStreamDetail(task)
            : undefined,
    };
  }

  if (o.type === 'groupChatTurn' || o.type === 'groupChatFinish') {
    const speaker = o.speaker != null ? String(o.speaker) : t(labels, 'editor.groupChat.orchestrator');
    const round =
      o.round != null ? t(labels, 'timeline.round', { n: String(o.round) }) : undefined;
    const status = String(o.status ?? 'success');
    if (status === 'running') {
      return {
        label: [speaker, t(labels, 'editor.groupChat.turn'), round].filter(Boolean).join(' · '),
        detail: o.selectionReason != null ? formatStreamDetail(o.selectionReason) : undefined,
      };
    }
    if (o.type === 'groupChatFinish') {
      return {
        label: t(labels, 'editor.groupChat.finish'),
        detail: o.content != null ? formatStreamDetail(o.content) : undefined,
      };
    }
    return {
      label: [speaker, t(labels, 'editor.groupChat.turn'), round].filter(Boolean).join(' · '),
      detail: o.content != null ? formatStreamDetail(o.content) : undefined,
    };
  }

  return { label: 'agent_step', detail: formatStreamDetail(step) };
}

export function formatAgentStreamLine(
  labels: LabelMap,
  entry: AgentStreamLogEntry,
  context?: AgentStreamFormatContext,
): { label: string; detail?: string } {
  if (entry.type === 'tool_start') {
    return {
      label: t(labels, 'editor.toolStart', { tool: entry.tool ?? 'tool' }),
      detail: entry.input !== undefined ? formatStreamDetail(entry.input) : undefined,
    };
  }
  if (entry.type === 'tool_end') {
    return {
      label: t(labels, 'editor.toolEnd', { tool: entry.tool ?? 'tool' }),
      detail: entry.output !== undefined ? formatStreamDetail(entry.output) : undefined,
    };
  }
  if (entry.type === 'satellite_schema_read') {
    return {
      label: t(labels, 'editor.satelliteSchemaRead'),
      detail: entry.schema !== undefined ? formatStreamDetail(entry.schema) : undefined,
    };
  }
  if (entry.type === 'satellite_memory_snapshot') {
    const count = entry.messages?.length ?? 0;
    return {
      label: t(labels, 'editor.satelliteMemorySnapshot', { count: String(count) }),
      detail:
        entry.sessionId && count > 0
          ? `${entry.sessionId} · ${count}`
          : entry.sessionId ?? undefined,
    };
  }
  if (entry.type === 'satellite_knowledge_query') {
    const count = entry.chunks?.length ?? 0;
    return {
      label: t(labels, 'editor.satelliteKnowledgeQuery', { count: String(count) }),
      detail: formatKnowledgeRetrievalDetail(entry.query, entry.chunks),
    };
  }
  if (entry.type === 'satellite_invoke_start') {
    return {
      label: t(labels, 'editor.satelliteInvokeStart'),
      detail: entry.input !== undefined ? formatStreamDetail(entry.input) : undefined,
    };
  }
  if (entry.type === 'satellite_invoke_end') {
    if (entry.error) {
      const failedLabel =
        context?.nodeType === 'aiChatModel'
          ? t(labels, 'editor.chatModelInvokeFailed', {
              name: context.nodeName?.trim() || 'Chat Model',
            })
          : t(labels, 'editor.satelliteInvokeFailed');
      return {
        label: failedLabel,
        detail: entry.error,
      };
    }
    if (context?.nodeType === 'aiChatModel') {
      const name = context.nodeName?.trim() || 'Chat Model';
      const label =
        entry.durationMs != null
          ? t(labels, 'editor.chatModelInvokeDuration', {
              name,
              ms: String(entry.durationMs),
            })
          : t(labels, 'editor.chatModelInvokeEnd', { name });
      return {
        label,
        detail: entry.output !== undefined ? formatLlmInvokeOutput(entry.output) : undefined,
      };
    }
    const ms =
      entry.durationMs != null
        ? t(labels, 'editor.satelliteInvokeDuration', { ms: String(entry.durationMs) })
        : t(labels, 'editor.satelliteInvokeEnd');
    return {
      label: ms,
      detail: entry.output !== undefined ? formatStreamDetail(entry.output) : undefined,
    };
  }
  if (entry.type === 'token' && entry.content) {
    return { label: 'token', detail: entry.content };
  }
  if (entry.type === 'agent_step') {
    const formatted = formatAgentStepPayload(labels, entry.step);
    if (formatted) return formatted;
  }
  if (entry.tool) {
    return { label: entry.tool };
  }
  if (entry.content) {
    return { label: entry.type, detail: entry.content };
  }
  const payload =
    entry.output !== undefined
      ? entry.output
      : entry.input !== undefined
        ? entry.input
        : entry.step;
  if (payload !== undefined) {
    return { label: entry.type, detail: formatStreamDetail(payload) };
  }
  return { label: entry.type };
}

export const AGENT_STREAM_NODE_TYPES = new Set([
  'aiAgent',
  'crewSequential',
  'crewHierarchical',
  'crewSupervisor',
  'groupChat',
]);

export function nodeShowsAgentStream(nodeType: string | undefined): boolean {
  if (nodeType == null) return false;
  return AGENT_STREAM_NODE_TYPES.has(nodeType) || isSatelliteNodeType(nodeType);
}
