import { describe, expect, it } from 'vitest';
import {
  appendAgentStreamChunk,
  applyAgentOrSatelliteStream,
  applyNodeDebugResults,
  backfillChatModelInvocationOutputs,
  buildHubAgentSyncPayloadFromOutputItems,
  buildLlmResponsesFromHubOutputItems,
  clearSatelliteDebugForHubRun,
  countSatelliteInvocations,
  syncHubSatellitesOnAgentSuccess,
  markDebugNodeStarted,
} from './node-debug-run-state.js';
import type { WorkflowDefinition } from '../../api/client.js';

describe('node-debug-run-state live agent stream', () => {
  it('appendAgentStreamChunk accumulates chunks on running node', () => {
    const next = appendAgentStreamChunk({}, 'agent-1', { type: 'token', content: 'hi' }, {
      runId: 'run-1',
      runSeq: 1,
    });
    expect(next['agent-1']?.status).toBe('running');
    expect(next['agent-1']?.agentStream).toEqual([{ type: 'token', content: 'hi' }]);

    const again = appendAgentStreamChunk(next, 'agent-1', {
      type: 'tool_start',
      tool: 'search',
      input: { q: 'x' },
    });
    expect(again['agent-1']?.agentStream).toHaveLength(2);
  });

  it('applyAgentOrSatelliteStream records satellite invoke timeline and output', () => {
    let next = applyAgentOrSatelliteStream(
      {},
      'model-1',
      { type: 'satellite_invoke_start', input: { messages: [] } },
      { runId: 'run-1', runSeq: 1 },
    );
    expect(next['model-1']?.status).toBe('running');
    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_end',
      output: { content: 'hello' },
      durationMs: 42,
    });
    expect(next['model-1']?.status).toBe('success');
    expect(next['model-1']?.agentStream).toHaveLength(2);
    expect(next['model-1']?.outputItems?.[0]).toHaveLength(1);
    expect(next['model-1']?.outputItems?.[0]?.[0]?.json).toMatchObject({
      input: { messages: [] },
      output: { content: 'hello' },
      durationMs: 42,
    });

    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_start',
      input: { messages: [{ role: 'user' }] },
    });
    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_end',
      output: { content: 'again' },
      durationMs: 10,
    });
    expect(next['model-1']?.outputItems?.[0]).toHaveLength(2);
  });

  it('pairs satellite_invoke_end input with the matching open start', () => {
    let next = applyAgentOrSatelliteStream({}, 'model-1', {
      type: 'satellite_invoke_start',
      input: ['first'],
    });
    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_start',
      input: ['second'],
    });
    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_end',
      output: { content: 'a' },
    });
    expect(next['model-1']?.outputItems?.[0]?.[0]?.json.input).toEqual(['first']);
    next = applyAgentOrSatelliteStream(next, 'model-1', {
      type: 'satellite_invoke_end',
      output: { content: 'b' },
    });
    expect(next['model-1']?.outputItems?.[0]?.[1]?.json.input).toEqual(['second']);
  });

  it('countSatelliteInvocations prefers outputItems then stream ends', () => {
    expect(countSatelliteInvocations({ outputItems: [[{ json: {} }, { json: {} }]] })).toBe(2);
    expect(
      countSatelliteInvocations({
        agentStream: [
          { type: 'satellite_invoke_start', input: {} },
          { type: 'satellite_invoke_end', output: {} },
        ],
      }),
    ).toBe(1);
  });

  it('buildLlmResponsesFromHubOutputItems collects each agent item answer', () => {
    expect(
      buildLlmResponsesFromHubOutputItems([
        { json: { answer: '{"answer":"intro"}' } },
        { json: { answer: '{"answer":"hello"}' } },
      ]),
    ).toEqual(['{"answer":"intro"}', '{"answer":"hello"}']);
  });

  it('prefers per-item answer over llmResponses when hub has multiple items', () => {
    expect(
      buildLlmResponsesFromHubOutputItems([
        {
          json: {
            answer: '{"answer":"intro"}',
            llmResponses: ['{"answer":"intro"}', '{"answer":"intro"}'],
          },
        },
        { json: { answer: '{"answer":"hello"}' } },
      ]),
    ).toEqual(['{"answer":"intro"}', '{"answer":"hello"}']);
  });

  it('buildHubAgentSyncPayloadFromOutputItems uses the last item as hub answer', () => {
    expect(
      buildHubAgentSyncPayloadFromOutputItems([
        [
          { json: { answer: '{"answer":"intro"}' } },
          {
            json: {
              answer: '{"answer":"hello"}',
              parsed: { answer: 'hello' },
            },
          },
        ],
      ]),
    ).toEqual({
      answer: '{"answer":"hello"}',
      parsed: { answer: 'hello' },
      llmResponses: ['{"answer":"intro"}', '{"answer":"hello"}'],
    });
  });

  it('backfillChatModelInvocationOutputs patches duration-only invoke rows', () => {
    const next = backfillChatModelInvocationOutputs(
      {
        status: 'success',
        outputItems: [
          [
            { json: { durationMs: 10 } },
            { json: { durationMs: 20 } },
          ],
        ],
        agentStream: [
          { type: 'satellite_invoke_start', input: [{ role: 'user' }] },
          { type: 'satellite_invoke_end', durationMs: 10 },
          { type: 'satellite_invoke_start', input: [{ role: 'user' }] },
          { type: 'satellite_invoke_end', durationMs: 20 },
        ],
      },
      ['first answer', 'second answer'],
    );
    expect(next.outputItems?.[0]?.[0]?.json.output).toEqual({ content: 'first answer' });
    expect(next.outputItems?.[0]?.[1]?.json.output).toEqual({ content: 'second answer' });
    expect(next.agentStream?.[1]).toMatchObject({
      type: 'satellite_invoke_end',
      output: { content: 'first answer' },
    });
  });

  it('backfillChatModelInvocationOutputs does not repeat the last llmResponse', () => {
    const next = backfillChatModelInvocationOutputs(
      {
        status: 'success',
        outputItems: [
          [
            { json: { durationMs: 10 } },
            { json: { durationMs: 20 } },
          ],
        ],
      },
      ['only-once'],
    );
    expect(next.outputItems?.[0]?.[0]?.json.output).toEqual({ content: 'only-once' });
    expect(next.outputItems?.[0]?.[1]?.json.output).toBeUndefined();
  });

  it('backfillChatModelInvocationOutputs does not fill extra invoke slots from hub index 0', () => {
    const next = backfillChatModelInvocationOutputs(
      {
        status: 'success',
        outputItems: [
          [
            { json: { output: { content: '{"answer":"intro"}' } } },
            { json: { output: { content: '{"answer":"hello"}' } } },
            { json: { durationMs: 30 } },
          ],
        ],
      },
      ['{"answer":"intro"}', '{"answer":"hello"}'],
    );
    expect(next.outputItems?.[0]?.[2]?.json.output).toBeUndefined();
  });

  it('syncHubSatellitesOnAgentSuccess backfills chat model outputs from llmResponses', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'm', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'm', to: 'a', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };
    const nodeDebug = {
      m: {
        status: 'success' as const,
        outputItems: [
          [
            { json: { durationMs: 10 } },
            { json: { durationMs: 20 } },
          ],
        ],
        agentStream: [
          { type: 'satellite_invoke_start' as const, input: [{ role: 'user' }] },
          { type: 'satellite_invoke_end' as const, durationMs: 10 },
          { type: 'satellite_invoke_start' as const, input: [{ role: 'user' }] },
          { type: 'satellite_invoke_end' as const, durationMs: 20 },
        ],
      },
    };
    const next = syncHubSatellitesOnAgentSuccess(nodeDebug, def, 'a', {
      answer: 'final',
      llmResponses: ['round one', 'round two'],
    });
    expect(next.m?.outputItems?.[0]?.[0]?.json.output).toEqual({ content: 'round one' });
    expect(next.m?.outputItems?.[0]?.[1]?.json.output).toEqual({ content: 'round two' });
  });

  it('syncHubSatellitesOnAgentSuccess synthesizes missing satellite_invoke_end with hub answer', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'm', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'm', to: 'a', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };
    const nodeDebug = {
      m: {
        status: 'running' as const,
        agentStream: [{ type: 'satellite_invoke_start' as const, input: [{ role: 'user' }] }],
      },
    };
    const next = syncHubSatellitesOnAgentSuccess(nodeDebug, def, 'a', {
      answer: '{"answer":"ok"}',
      llmResponses: ['{"answer":"ok"}'],
    });
    expect(next.m?.status).toBe('success');
    expect(next.m?.agentStream).toHaveLength(2);
    expect(next.m?.agentStream?.[1]).toMatchObject({
      type: 'satellite_invoke_end',
      output: { content: '{"answer":"ok"}' },
    });
    expect(next.m?.outputItems?.[0]?.[0]?.json).toMatchObject({
      output: { content: '{"answer":"ok"}' },
    });
  });

  it('bootstraps Output Parser with a single schema_read event', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        {
          id: 'p',
          type: 'aiOutputParser',
          name: 'Parser',
          position: { x: 0, y: 0 },
          parameters: { jsonSchema: { type: 'object', properties: { answer: { type: 'string' } } } },
        },
      ],
      connections: [
        { from: 'p', to: 'a', fromOutput: 'ai_outputParser', toInput: 'ai_outputParser' },
      ],
    };
    const result = syncHubSatellitesOnAgentSuccess({}, def, 'a');
    expect(result.p?.status).toBe('success');
    expect(result.p?.agentStream).toEqual([
      {
        type: 'satellite_schema_read',
        schema: { type: 'object', properties: { answer: { type: 'string' } } },
      },
    ]);
    expect(result.p?.outputItems?.[0]?.[0]?.json).toEqual({
      schema: { type: 'object', properties: { answer: { type: 'string' } } },
    });
  });

  it('applyNodeDebugResults accumulates loop body iterations', () => {
    const next = applyNodeDebugResults({}, {
      cmd: {
        status: 'success',
        itemCount: 1,
        durationMs: 10,
        outputItems: [[{ json: { round: 1 } }]],
        loopIteration: {
          round: 1,
          totalRounds: 2,
          inputItems: [{ json: { a: 0 } }],
        },
      },
    });
    const next2 = applyNodeDebugResults(next, {
      cmd: {
        status: 'success',
        itemCount: 1,
        durationMs: 12,
        outputItems: [[{ json: { round: 2 } }]],
        loopIteration: {
          round: 2,
          totalRounds: 2,
          inputItems: [{ json: { a: 1 } }],
        },
      },
    });
    expect(next2.cmd?.loopIterations).toHaveLength(2);
    expect(next2.cmd?.loopIterations?.[0]?.inputItems[0]?.json).toEqual({ a: 0 });
    expect(next2.cmd?.loopIterations?.[1]?.inputItems[0]?.json).toEqual({ a: 1 });
    expect(next2.cmd?.durationMs).toBe(22);
    expect(next2.cmd?.outputItems?.[0]?.[0]?.json).toEqual({ round: 2 });
  });

  it('applyNodeDebugResults stores inputItems as inputPreview', () => {
    const next = applyNodeDebugResults({}, {
      cmd2: {
        status: 'success',
        itemCount: 2,
        inputItems: [{ json: { stdout: 'a' } }, { json: { stdout: 'b' } }],
        outputItems: [[{ json: { stdout: 'rxwf' } }]],
      },
    });
    expect(next.cmd2?.inputPreview).toEqual([
      { json: { stdout: 'a' } },
      { json: { stdout: 'b' } },
    ]);
  });

  it('applyNodeDebugResults keeps richer live agentStream on failure', () => {
    const prev = {
      agt: {
        status: 'running' as const,
        agentStream: [
          { type: 'agent_step', step: { kind: 'agentItemStart', userMessage: 'a' } },
          { type: 'agent_step', step: { kind: 'chatModel', phase: 'start' } },
          { type: 'agent_step', step: { kind: 'chatModel', phase: 'end', output: { content: '' } } },
        ],
      },
    };
    const next = applyNodeDebugResults(prev, {
      agt: {
        status: 'failed',
        errorMessage: 'Agent returned empty answer for structured output',
        agentStream: [{ type: 'tool_start', tool: 'x', input: {} }],
      },
    });
    expect(next.agt?.agentStream).toHaveLength(3);
    expect(next.agt?.errorMessage).toContain('empty answer');
  });

  it('applyAgentOrSatelliteStream records satellite_schema_read', () => {
    const next = applyAgentOrSatelliteStream({}, 'parser-1', {
      type: 'satellite_schema_read',
      schema: { type: 'object' },
    });
    expect(next['parser-1']?.status).toBe('success');
    expect(next['parser-1']?.agentStream).toHaveLength(1);
    expect(next['parser-1']?.outputItems?.[0]?.[0]?.json).toEqual({ schema: { type: 'object' } });
  });

  it('applyAgentOrSatelliteStream records satellite_knowledge_query', () => {
    const queryResult = {
      query: 'docs',
      knowledgeBaseIds: ['kb-1'],
      chunks: [{ text: 'hello', score: 0.9, documentName: 'a.md', knowledgeBaseId: 'kb-1', documentId: 'd1', chunkIndex: 0 }],
    };
    const next = applyAgentOrSatelliteStream({}, 'kb-1', {
      type: 'satellite_knowledge_query',
      ...queryResult,
    });
    expect(next['kb-1']?.status).toBe('success');
    expect(next['kb-1']?.outputItems?.[0]?.[0]?.json).toEqual(queryResult);
  });

  it('applyAgentOrSatelliteStream records satellite_memory_snapshot', () => {
    const snapshot = {
      sessionId: 'sess-1',
      messages: [{ role: 'user', content: 'hi' }],
    };
    const next = applyAgentOrSatelliteStream({}, 'memory-1', {
      type: 'satellite_memory_snapshot',
      ...snapshot,
    });
    expect(next['memory-1']?.status).toBe('success');
    expect(next['memory-1']?.outputItems?.[0]?.[0]?.json).toEqual(snapshot);
  });

  it('syncHubSatellitesOnAgentSuccess clears running chat model when agent succeeds', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'm', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'm', to: 'a', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };
    const nodeDebug = {
      a: { status: 'success' as const },
      m: { status: 'running' as const },
    };
    const next = syncHubSatellitesOnAgentSuccess(nodeDebug, def, 'a');
    expect(next.m?.status).toBe('success');
    expect(next.m?.itemCount).toBe(1);
  });

  it('clearSatelliteDebugForHubRun removes prior satellite badges', () => {
    const def: WorkflowDefinition = {
      schemaVersion: 1,
      name: 't',
      nodes: [
        { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'm', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 'm', to: 'a', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      ],
    };
    const next = clearSatelliteDebugForHubRun(
      { m: { status: 'running' as const } },
      def,
      'a',
    );
    expect(next.m).toBeUndefined();
  });

  it('markDebugNodeStarted sets running without clearing stream', () => {
    const base = appendAgentStreamChunk({}, 'agent-1', { type: 'token', content: 'a' });
    const next = markDebugNodeStarted(base, 'agent-1', { runId: 'run-1', runSeq: 2 });
    expect(next['agent-1']?.status).toBe('running');
    expect(next['agent-1']?.agentStream).toHaveLength(1);
  });
});
