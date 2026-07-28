import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { NodeExecutionContext } from '../types/node-executor.js';

function resolveSatelliteNodeName(
  definition: WorkflowDefinition | undefined,
  satelliteNodeId: string,
): string {
  return (
    definition?.nodes.find((n) => n.id === satelliteNodeId)?.name?.trim() ?? satelliteNodeId
  );
}

/** Mirror inner satellite events onto the toolSubagent hub timeline as agent_step. */
export function mirrorInnerSatelliteForSubagentHub(
  definition: WorkflowDefinition | undefined,
  satelliteNodeId: string,
  chunk: AiStreamChunk,
): AiStreamChunk | null {
  const satelliteNodeName = resolveSatelliteNodeName(definition, satelliteNodeId);
  if (chunk.type === 'satellite_invoke_start') {
    return {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'start',
        satelliteNodeId,
        satelliteNodeName,
        input: chunk.input,
      },
    };
  }
  if (chunk.type === 'satellite_invoke_end') {
    return {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'end',
        satelliteNodeId,
        satelliteNodeName,
        output: chunk.output,
        error: chunk.error,
        durationMs: chunk.durationMs,
      },
    };
  }
  if (chunk.type === 'satellite_schema_read') {
    return {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'schema',
        satelliteNodeId,
        satelliteNodeName,
        schema: chunk.schema,
      },
    };
  }
  if (chunk.type === 'satellite_memory_snapshot') {
    return {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'memory',
        satelliteNodeId,
        satelliteNodeName,
        sessionId: chunk.sessionId,
        messageCount: chunk.messages?.length ?? 0,
      },
    };
  }
  if (chunk.type === 'satellite_knowledge_query') {
    return {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'knowledge',
        satelliteNodeId,
        satelliteNodeName,
        query: chunk.query,
        knowledgeBaseIds: chunk.knowledgeBaseIds,
        chunkCount: chunk.chunks?.length ?? 0,
        chunks: chunk.chunks,
      },
    };
  }
  return null;
}

export function emitSubagentRunStart(
  ctx: Pick<NodeExecutionContext, 'onSatelliteStream'>,
  hubNodeId: string,
  userMessage: string,
): void {
  ctx.onSatelliteStream?.(hubNodeId, {
    type: 'agent_step',
    step: { kind: 'subagentRunStart', userMessage },
  });
}

export function emitSubagentRunEnd(
  ctx: Pick<NodeExecutionContext, 'onSatelliteStream'>,
  hubNodeId: string,
  answer: string,
): void {
  ctx.onSatelliteStream?.(hubNodeId, {
    type: 'agent_step',
    step: { kind: 'subagentRunEnd', answer },
  });
}

/** Route synthetic sub-agent streams onto the toolSubagent hub node for debug UI. */
export function wrapSubagentExecutionStreams(
  ctx: NodeExecutionContext,
  hubNodeId: string,
): Pick<NodeExecutionContext, 'onAgentStream' | 'onSatelliteStream'> {
  const forwardAgentChunkToHub = (chunk: AiStreamChunk) => {
    ctx.onSatelliteStream?.(hubNodeId, chunk);
  };

  const onAgentStream = ctx.onAgentStream
    ? (chunk: AiStreamChunk) => {
        ctx.onAgentStream!(chunk);
        forwardAgentChunkToHub(chunk);
      }
    : ctx.onSatelliteStream
      ? forwardAgentChunkToHub
      : undefined;

  const onSatelliteStream = ctx.onSatelliteStream
    ? (satelliteNodeId: string, chunk: AiStreamChunk) => {
        ctx.onSatelliteStream!(satelliteNodeId, chunk);
        const mirrored = mirrorInnerSatelliteForSubagentHub(
          ctx.workflowDefinition,
          satelliteNodeId,
          chunk,
        );
        if (mirrored) {
          ctx.onSatelliteStream!(hubNodeId, mirrored);
        }
      }
    : undefined;

  return { onAgentStream, onSatelliteStream };
}
