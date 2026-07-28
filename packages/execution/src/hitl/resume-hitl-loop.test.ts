import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { resumeHitlExecution } from './resume-hitl.js';

describe('resumeHitlExecution hitlLoopOnReject', () => {
  it('re-runs upstream skillRun on reject when hitlLoopOnReject is true', async () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'loop-test',
      nodes: [
        { id: 't', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
        {
          id: 's1',
          type: 'skillRun',
          name: 'S',
          position: { x: 100, y: 0 },
          parameters: { skillSource: 'inline', skillInline: 'x' },
        },
        {
          id: 'h1',
          type: 'humanApproval',
          name: 'H',
          position: { x: 200, y: 0 },
          parameters: { hitlLoopOnReject: true, allowReject: true },
        },
      ],
      connections: [
        { from: 't', to: 's1' },
        { from: 's1', to: 'h1' },
      ],
    };

    const executed: string[] = [];
    const embeddedRunner = {
      runnerId: 'embedded-test',
      runnerPlatform: { os: 'linux' as const, arch: 'x64' as const },
    };
    const result = await resumeHitlExecution(
      {
        executeNodeRun: async (job) => {
          executed.push(job.nodeType);
          if (job.nodeType === 'skillRun') {
            return {
              status: 'success',
              outputItems: [[{ json: { answer: 'retry' } }]],
              ...embeddedRunner,
            };
          }
          if (job.nodeType === 'humanApproval') {
            return {
              status: 'waiting',
              metadata: { hitl: { prompt: 'p' } },
              ...embeddedRunner,
            };
          }
          return { status: 'success', outputItems: [[{ json: {} }]], ...embeddedRunner };
        },
      },
      {
        executionId: 'ex-1',
        definition,
        nodeRuns: [
          {
            id: 'nr-t',
            nodeId: 't',
            nodeType: 'manualTrigger',
            status: 'success',
            outputData: [[{ json: {} }]],
            metadata: null,
          },
          {
            id: 'nr-s',
            nodeId: 's1',
            nodeType: 'skillRun',
            status: 'success',
            outputData: [[{ json: { answer: 'first' } }]],
            metadata: null,
          },
          {
            id: 'nr-h',
            nodeId: 'h1',
            nodeType: 'humanApproval',
            status: 'waiting',
            outputData: null,
            metadata: { hitl: { prompt: 'approve' } },
          },
        ],
        waitingNodeId: 'h1',
        decision: 'reject',
        supplement: 'fix the spec',
        mode: 'manual',
      },
    );

    expect(result.status).toBe('waiting');
    expect(executed).toContain('skillRun');
    expect(executed[executed.length - 1]).toBe('humanApproval');
  });
});
