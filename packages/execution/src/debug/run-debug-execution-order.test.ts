import { describe, expect, it, vi } from 'vitest';
import { runDebugExecution } from './run-debug-execution.js';

describe('runDebugExecution execute order', () => {
  it('runs Manual → JSON → JSON 2 when nothing pinned', async () => {
    const order: string[] = [];
    const executeNodeRun = vi.fn(async (job: { nodeRunId: string }) => {
      order.push(job.nodeRunId);
      return {
        status: 'success' as const,
        outputItems: [[{ json: { step: job.nodeRunId } }]],
        runnerId: 'embedded',
        runnerPlatform: { os: 'linux', arch: 'x64' },
      };
    });

    await runDebugExecution({
      definition: {
        schemaVersion: 1,
        name: 'w',
        nodes: [
          {
            id: 't',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'j',
            type: 'json',
            name: 'JSON',
            position: { x: 0, y: 0 },
            parameters: { expression: '{}' },
          },
          {
            id: 'j2',
            type: 'json',
            name: 'JSON 2',
            position: { x: 0, y: 0 },
            parameters: { expression: '{}' },
          },
        ],
        connections: [
          { from: 't', to: 'j' },
          { from: 'j', to: 'j2' },
        ],
      },
      targetNodeId: 'j2',
      pinData: {},
      executeNodeRun,
    });

    expect(order).toEqual(['t', 'j', 'j2']);
  });
});
