import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';

function resolveSatelliteNodeName(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
): string {
  return (
    definition.nodes.find((n) => n.id === satelliteNodeId)?.name?.trim() ?? satelliteNodeId
  );
}

/** Mirror satellite LLM/parser events onto the hub agent log timeline. */
export function mirrorSatelliteStreamForHub(
  definition: WorkflowDefinition,
  satelliteNodeId: string,
  chunk: AiStreamChunk,
): AiStreamChunk | null {
  const satelliteNodeName = resolveSatelliteNodeName(definition, satelliteNodeId);
  if (chunk.type === 'satellite_invoke_start') {
    return {
      type: 'agent_step',
      step: {
        kind: 'chatModel',
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
        kind: 'chatModel',
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
        kind: 'outputParser',
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
        kind: 'memory',
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
        kind: 'knowledge',
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
