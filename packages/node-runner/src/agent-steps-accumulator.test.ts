import { describe, expect, it } from 'vitest';
import { createAgentStepsAccumulator } from './agent-steps-accumulator.js';

describe('createAgentStepsAccumulator', () => {
  it('collects chunks and exposes final agentSteps', () => {
    const acc = createAgentStepsAccumulator();
    acc.push({ type: 'tool_start', tool: 'T', input: {} });
    acc.push({ type: 'tool_end', tool: 'T', output: 1 });
    expect(acc.getSteps().length).toBe(1);
    expect(acc.getSteps()[0]?.status).toBe('success');
  });
});
