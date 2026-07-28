import { describe, expect, it } from 'vitest';
import { chunksToAgentSteps } from './agent-steps.js';

describe('chunksToAgentSteps', () => {
  it('merges tool_start and tool_end into one record with durationMs', () => {
    const t0 = 1000;
    const t1 = 1500;
    const steps = chunksToAgentSteps([
      { type: 'tool_start', tool: 'ListDir', input: { path: '/' }, at: t0 },
      { type: 'tool_end', tool: 'ListDir', output: { ok: true }, at: t1 },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      tool: 'ListDir',
      status: 'success',
      durationMs: 500,
    });
  });
});
