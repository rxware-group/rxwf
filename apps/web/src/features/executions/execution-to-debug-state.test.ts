import { describe, it, expect } from 'vitest';
import type { ExecutionDetail } from '../../api/client.js';
import { executionToDebugState } from './execution-to-debug-state.js';

describe('executionToDebugState', () => {
  it('maps node runs to debug state and pin data', () => {
    const detail: ExecutionDetail = {
      id: 'ex-1',
      status: 'success',
      workflowId: 'wf-1',
      definitionSnapshot: {
        schemaVersion: 1,
        name: 'Test',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'c1',
            type: 'code',
            name: 'Code',
            position: { x: 200, y: 0 },
            parameters: {},
          },
        ],
        connections: [{ from: 't1', to: 'c1' }],
      },
      nodeRuns: [
        {
          nodeId: 't1',
          nodeType: 'manualTrigger',
          status: 'success',
          durationMs: 5,
          outputData: [[{ json: { x: 1 } }]],
        },
        {
          nodeId: 'c1',
          nodeType: 'code',
          status: 'success',
          durationMs: 12,
          outputData: [[{ json: { y: 2 } }]],
          metadata: {
            logs: [
              {
                level: 'info',
                message: 'hello',
                timestamp: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      ],
    };

    const mapped = executionToDebugState(detail);
    expect(mapped.definition.nodes).toHaveLength(2);
    expect(mapped.nodeDebug.t1?.status).toBe('success');
    expect(mapped.nodeDebug.t1?.runSeq).toBe(1);
    expect(mapped.nodeDebug.c1?.logs?.[0]?.message).toBe('hello');
    expect(mapped.nodeDebug.c1?.runSeq).toBe(2);
    expect(mapped.pinData.t1).toEqual([{ json: { x: 1 } }]);
  });
});
