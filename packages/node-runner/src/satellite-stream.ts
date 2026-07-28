import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { WorkflowNode } from '@rxwf/workflow';
import type { NodeExecutionContext } from './types/node-executor.js';

export function resolveToolSatelliteNodeId(
  def: ToolDefinition,
  toolNodeByName: Map<string, WorkflowNode>,
): string | undefined {
  const src = def.source;
  if (
    (src.type === 'filesystem' || src.type === 'shell' || src.type === 'web_search') &&
    src.toolNodeId
  ) {
    return src.toolNodeId;
  }
  if (src.type === 'subagent') return src.hubNodeId;
  return toolNodeByName.get(def.name)?.id;
}

export async function withSatelliteInvokeTelemetry<T>(
  ctx: Pick<NodeExecutionContext, 'onSatelliteStream'>,
  satelliteNodeId: string | undefined,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  if (satelliteNodeId) {
    ctx.onSatelliteStream?.(satelliteNodeId, {
      type: 'satellite_invoke_start',
      input,
    });
  }
  try {
    const output = await fn();
    if (satelliteNodeId) {
      ctx.onSatelliteStream?.(satelliteNodeId, {
        type: 'satellite_invoke_end',
        output,
        durationMs: Date.now() - started,
      });
    }
    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (satelliteNodeId) {
      ctx.onSatelliteStream?.(satelliteNodeId, {
        type: 'satellite_invoke_end',
        error: message,
        durationMs: Date.now() - started,
      });
    }
    throw err;
  }
}

export type SatelliteStreamEmitter = (
  satelliteNodeId: string,
  chunk: AiStreamChunk,
) => void;
