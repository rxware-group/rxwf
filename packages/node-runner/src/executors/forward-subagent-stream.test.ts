import { describe, expect, it, vi } from 'vitest';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import {
  emitSubagentRunEnd,
  emitSubagentRunStart,
  mirrorInnerSatelliteForSubagentHub,
  wrapSubagentExecutionStreams,
} from './forward-subagent-stream.js';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 't',
  nodes: [
    { id: 'sub1', type: 'toolSubagent', name: 'Research', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'read1', type: 'toolRead', name: 'ReadFile', position: { x: 0, y: 80 }, parameters: {} },
  ],
  connections: [],
};

describe('mirrorInnerSatelliteForSubagentHub', () => {
  it('wraps satellite_invoke_start as subagentSatellite agent_step', () => {
    const mirrored = mirrorInnerSatelliteForSubagentHub(definition, 'read1', {
      type: 'satellite_invoke_start',
      input: { path: 'a.txt' },
    });
    expect(mirrored).toEqual({
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'start',
        satelliteNodeId: 'read1',
        satelliteNodeName: 'ReadFile',
        input: { path: 'a.txt' },
      },
    });
  });
});

describe('wrapSubagentExecutionStreams', () => {
  it('forwards inner onAgentStream chunks to hub via onSatelliteStream', () => {
    const onAgentStream = vi.fn();
    const onSatelliteStream = vi.fn();
    const wrapped = wrapSubagentExecutionStreams(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
        onAgentStream,
        onSatelliteStream,
      },
      'sub1',
    );

    const chunk: AiStreamChunk = { type: 'tool_start', tool: 'ReadFile', input: { path: 'x' } };
    wrapped.onAgentStream?.(chunk);

    expect(onAgentStream).toHaveBeenCalledWith(chunk);
    expect(onSatelliteStream).toHaveBeenCalledWith('sub1', chunk);
  });

  it('mirrors inner satellite streams to hub while preserving original target', () => {
    const onSatelliteStream = vi.fn();
    const wrapped = wrapSubagentExecutionStreams(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
        onSatelliteStream,
      },
      'sub1',
    );

    wrapped.onSatelliteStream?.('read1', {
      type: 'satellite_invoke_end',
      output: { content: 'file body' },
      durationMs: 42,
    });

    expect(onSatelliteStream).toHaveBeenCalledTimes(2);
    expect(onSatelliteStream).toHaveBeenNthCalledWith(1, 'read1', {
      type: 'satellite_invoke_end',
      output: { content: 'file body' },
      durationMs: 42,
    });
    expect(onSatelliteStream).toHaveBeenNthCalledWith(2, 'sub1', {
      type: 'agent_step',
      step: expect.objectContaining({
        kind: 'subagentSatellite',
        phase: 'end',
        satelliteNodeId: 'read1',
        satelliteNodeName: 'ReadFile',
      }),
    });
  });
});

describe('emitSubagentRunStart/End', () => {
  it('emits subagent run boundary steps on hub', () => {
    const onSatelliteStream = vi.fn();
    const ctx = { config: {}, inputItems: [], onSatelliteStream };
    emitSubagentRunStart(ctx, 'sub1', 'do task');
    emitSubagentRunEnd(ctx, 'sub1', 'done');

    expect(onSatelliteStream).toHaveBeenNthCalledWith(1, 'sub1', {
      type: 'agent_step',
      step: { kind: 'subagentRunStart', userMessage: 'do task' },
    });
    expect(onSatelliteStream).toHaveBeenNthCalledWith(2, 'sub1', {
      type: 'agent_step',
      step: { kind: 'subagentRunEnd', answer: 'done' },
    });
  });
});
