import { describe, it, expect, vi } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutionRunner } from './execution-runner.js';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'Run',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'T',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 's1',
      type: 'set',
      name: 'S',
      position: { x: 1, y: 0 },
      parameters: {},
    },
  ],
  connections: [{ from: 't1', to: 's1' }],
};

describe('createExecutionRunner', () => {
  it('runs DAG via engine and updates execution status', async () => {
    const statuses: string[] = [];
    const executeNodeRun = vi.fn(async () => ({
      status: 'success' as const,
      outputItems: [[{ json: { ok: true } }]],
      runnerId: 'emb-1',
      runnerPlatform: { os: 'linux', arch: 'x64' },
    }));
    const runner = createExecutionRunner({
      executeNodeRun,
      updateExecutionStatus: async (_id, status) => {
        statuses.push(status);
      },
    });

    const result = await runner.runStoredExecution({
      executionId: 'ex-1',
      definition,
      mode: 'production',
    });

    expect(result.status).toBe('success');
    expect(statuses).toEqual(['running', 'success']);
    expect(executeNodeRun).toHaveBeenCalledTimes(2);
  });
});
