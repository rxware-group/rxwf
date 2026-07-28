import { describe, expect, it, vi } from 'vitest';
import type { WorkflowItem } from '@rxwf/shared';
import {
  buildHitlDecisionOutput,
  buildPrecomputedOutputsFromNodeRuns,
  resumeHitlExecution,
} from './resume-hitl.js';

describe('resumeHitlExecution', () => {
  const definition = {
    schemaVersion: 1 as const,
    name: 'hitl-flow',
    nodes: [
      { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'ap', type: 'humanApproval', name: 'Approve', position: { x: 1, y: 0 }, parameters: {} },
      { id: 'set', type: 'set', name: 'Set', position: { x: 2, y: 0 }, parameters: { mode: 'manual', fields: {} } },
    ],
    connections: [
      { from: 'tr', to: 'ap' },
      { from: 'ap', to: 'set' },
    ],
  };

  it('reject short-circuits without running downstream', async () => {
    const executeNodeRun = vi.fn();
    const result = await resumeHitlExecution(
      { executeNodeRun },
      {
        executionId: 'e1',
        definition,
        waitingNodeId: 'ap',
        decision: 'reject',
        mode: 'manual',
        nodeRuns: [
          {
            id: 'nr1',
            nodeId: 'tr',
            nodeType: 'manualTrigger',
            status: 'success',
            outputData: [[{ json: { ok: true } }]],
            metadata: null,
          },
          {
            id: 'nr2',
            nodeId: 'ap',
            nodeType: 'humanApproval',
            status: 'waiting',
            outputData: null,
            metadata: { hitl: { prompt: 'Review' } },
          },
        ],
      },
    );
    expect(result.status).toBe('failed');
    expect(executeNodeRun).not.toHaveBeenCalled();
  });

  it('approve resumes from precomputed outputs and runs downstream', async () => {
    const executeNodeRun = vi.fn(async () => ({
      status: 'success' as const,
      outputItems: [[{ json: { done: true } }]] as WorkflowItem[][],
      runnerId: 'local',
      runnerPlatform: { os: 'test', arch: 'test' },
    }));
    const result = await resumeHitlExecution(
      { executeNodeRun },
      {
        executionId: 'e1',
        definition,
        waitingNodeId: 'ap',
        decision: 'approve',
        comment: 'LGTM',
        mode: 'manual',
        nodeRuns: [
          {
            id: 'nr1',
            nodeId: 'tr',
            nodeType: 'manualTrigger',
            status: 'success',
            outputData: [[{ json: { ok: true } }]],
            metadata: null,
          },
          {
            id: 'nr2',
            nodeId: 'ap',
            nodeType: 'humanApproval',
            status: 'waiting',
            outputData: null,
            metadata: { hitl: { prompt: 'Review' } },
          },
        ],
      },
    );
    expect(result.status).toBe('success');
    expect(executeNodeRun).toHaveBeenCalledTimes(1);
    const calls = (executeNodeRun as { mock: { calls: unknown[][] } }).mock.calls;
    expect((calls[0]![0] as { nodeRunId: string }).nodeRunId).toBe('set');
  });
});

describe('buildPrecomputedOutputsFromNodeRuns', () => {
  it('collects success outputs only', () => {
    const map = buildPrecomputedOutputsFromNodeRuns([
      {
        id: '1',
        nodeId: 'a',
        nodeType: 'x',
        status: 'success',
        outputData: [[{ json: { v: 1 } }]],
        metadata: null,
      },
      {
        id: '2',
        nodeId: 'b',
        nodeType: 'humanApproval',
        status: 'waiting',
        outputData: null,
        metadata: null,
      },
    ]);
    expect(map.size).toBe(1);
    expect(map.get('a')?.[0]?.[0]?.json).toEqual({ v: 1 });
  });
});

describe('buildHitlDecisionOutput', () => {
  it('marks approve output', () => {
    const out = buildHitlDecisionOutput('approve', [{ json: { x: 1 } }], { comment: 'ok' });
    expect(out[0]?.[0]?.json).toMatchObject({ approved: true, decision: 'approve', comment: 'ok' });
  });
});
