import type { AiStreamChunk } from './index.js';

export type AgentStepStatus = 'running' | 'success' | 'failed';

export interface AgentStepRecord {
  type: 'tool' | 'token' | 'agent_step';
  tool?: string;
  status: AgentStepStatus;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  content?: string;
}

export type TimestampedChunk = AiStreamChunk & { at?: number };

export function chunksToAgentSteps(chunks: TimestampedChunk[]): AgentStepRecord[] {
  const steps: AgentStepRecord[] = [];
  const open = new Map<string, { start: number; input: unknown }>();

  for (const chunk of chunks) {
    const at = chunk.at ?? Date.now();
    if (chunk.type === 'tool_start') {
      open.set(chunk.tool, { start: at, input: chunk.input });
      steps.push({
        type: 'tool',
        tool: chunk.tool,
        status: 'running',
        input: chunk.input,
      });
    } else if (chunk.type === 'tool_end') {
      const started = open.get(chunk.tool);
      const durationMs = started ? at - started.start : undefined;
      const idx = steps.findIndex(
        (s) => s.tool === chunk.tool && s.status === 'running',
      );
      if (idx >= 0) {
        steps[idx] = {
          type: 'tool',
          tool: chunk.tool,
          status: 'success',
          durationMs,
          input: started?.input,
          output: chunk.output,
        };
      } else {
        steps.push({
          type: 'tool',
          tool: chunk.tool,
          status: 'success',
          durationMs,
          output: chunk.output,
        });
      }
      open.delete(chunk.tool);
    } else if (chunk.type === 'token') {
      steps.push({ type: 'token', status: 'success', content: chunk.content });
    } else if (chunk.type === 'agent_step') {
      steps.push({ type: 'agent_step', status: 'success', output: chunk.step });
    }
  }
  for (const s of steps) {
    if (s.status === 'running') s.status = 'failed';
  }
  return steps;
}
