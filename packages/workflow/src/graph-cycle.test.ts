import { describe, it, expect } from 'vitest';
import { getLoopBodyNodeIds, hasDisallowedWorkflowCycle } from './graph-cycle.js';

describe('hasDisallowedWorkflowCycle', () => {
  it('detects cycles without a loop node', () => {
    expect(
      hasDisallowedWorkflowCycle(
        [
          { id: 'a', type: 'set' },
          { id: 'b', type: 'set' },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      ),
    ).toBe(true);
  });

  it('allows loop body re-entry edges back to the loop node', () => {
    expect(
      hasDisallowedWorkflowCycle(
        [
          { id: 'manual', type: 'manualTrigger' },
          { id: 'loop', type: 'loop' },
          { id: 'cmd', type: 'executeCommand' },
          { id: 'done', type: 'code' },
        ],
        [
          { from: 'manual', to: 'loop' },
          { from: 'loop', to: 'cmd', fromOutput: '0' },
          { from: 'loop', to: 'done', fromOutput: '1' },
          { from: 'cmd', to: 'loop' },
        ],
      ),
    ).toBe(false);
  });

  it('still rejects cycles wholly inside the loop body', () => {
    expect(
      hasDisallowedWorkflowCycle(
        [
          { id: 'loop', type: 'loop' },
          { id: 'a', type: 'set' },
          { id: 'b', type: 'set' },
        ],
        [
          { from: 'loop', to: 'a', fromOutput: '0' },
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      ),
    ).toBe(true);
  });

  it('getLoopBodyNodeIds excludes done branch nodes', () => {
    const body = getLoopBodyNodeIds('loop', [
      { from: 'loop', to: 'a', fromOutput: '0' },
      { from: 'a', to: 'b' },
      { from: 'loop', to: 'done', fromOutput: '1' },
      { from: 'b', to: 'done' },
    ]);
    expect([...body].sort()).toEqual(['a', 'b']);
  });
});
