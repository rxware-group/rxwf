import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import {
  chunksToAgentSteps,
  type AgentStepRecord,
  type TimestampedChunk,
} from '@rxwf/ai-runtime-stub';

export function createAgentStepsAccumulator() {
  const chunks: TimestampedChunk[] = [];
  return {
    push(chunk: AiStreamChunk) {
      chunks.push({ ...chunk, at: Date.now() });
    },
    getSteps(): AgentStepRecord[] {
      return chunksToAgentSteps(chunks);
    },
    getChunks(): TimestampedChunk[] {
      return chunks;
    },
  };
}
