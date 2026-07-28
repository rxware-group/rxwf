import { describe, expect, it, vi } from 'vitest';
import { runDebugExecution } from './run-debug-execution.js';

describe('runDebugExecution pinned upstream', () => {
  it('passes pinned upstream node into nodes for $nodes references', async () => {
    const executeNodeRun = vi.fn(
      async (job: {
        nodeRunId: string;
        nodes?: { name: string; json: Record<string, unknown> }[];
      }) => {
        if (job.nodeRunId === 'j2') {
          const jsonNode = job.nodes?.find((n) => n.name === 'JSON');
          expect(jsonNode?.json).toEqual({ a: 1 });
        }
        return {
          status: 'success' as const,
          outputItems: [[{ json: { ok: job.nodeRunId } }]],
          runnerId: 'embedded',
          runnerPlatform: { os: 'linux', arch: 'x64' },
        };
      },
    );

    const result = await runDebugExecution({
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
            position: { x: 100, y: 0 },
            parameters: { expression: '{}' },
          },
          {
            id: 'j2',
            type: 'json',
            name: 'JSON 2',
            position: { x: 200, y: 0 },
            parameters: {
              expression: '={{ $nodes["JSON"].json }}',
              _fieldModes: { expression: 'expression' },
            },
          },
        ],
        connections: [
          { from: 't', to: 'j' },
          { from: 'j', to: 'j2' },
        ],
      },
      targetNodeId: 'j2',
      pinData: { j: [{ json: { a: 1 } }] },
      executeNodeRun,
    });

    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(1);
  });
});
