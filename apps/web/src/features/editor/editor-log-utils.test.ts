import { describe, it, expect } from 'vitest';
import {
  formatLogTimestamp,
  listExecutedNodes,
  resolveNodeErrorPreview,
  resolveNodeInputPreview,
  resolveNodeOutputPreview,
} from './editor-log-utils.js';

const def = {
  schemaVersion: 1 as const,
  name: 'w',
  nodes: [
    {
      id: 'a',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    { id: 'b', type: 'set', name: 'Set A', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'c', type: 'code', name: 'Code', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'd', type: 'http', name: 'HTTP', position: { x: 0, y: 0 }, parameters: {} },
  ],
  connections: [],
};

describe('resolveNodeOutputPreview', () => {
  it('returns Output Parser schema from satellite_schema_read', () => {
    const schema = { type: 'object', properties: { answer: { type: 'string' } } };
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'p',
            type: 'aiOutputParser',
            name: 'Parser',
            position: { x: 0, y: 0 },
            parameters: { jsonSchema: schema },
          },
        ],
      },
      'p',
      {
        p: {
          status: 'success',
          agentStream: [{ type: 'satellite_schema_read', schema }],
          outputItems: [[{ json: { schema } }]],
        },
      },
    );
    expect(preview).toEqual({ kind: 'single', data: [schema] });
  });

  it('returns Knowledge query results from satellite_knowledge_query', () => {
    const result = {
      query: 'hello',
      knowledgeBaseIds: ['kb-1'],
      chunks: [{ text: 'chunk', score: 0.8, documentName: 'a.md', knowledgeBaseId: 'kb-1', documentId: 'd1', chunkIndex: 0 }],
    };
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'kb',
            type: 'aiKnowledge',
            name: 'Knowledge',
            position: { x: 0, y: 0 },
            parameters: { knowledgeBaseIds: ['kb-1'] },
          },
        ],
      },
      'kb',
      {
        kb: {
          status: 'success',
          agentStream: [{ type: 'satellite_knowledge_query', ...result }],
          outputItems: [[{ json: result }]],
        },
      },
    );
    expect(preview).toEqual({ kind: 'single', data: [result] });
  });

  it('returns Memory session messages from satellite_memory_snapshot', () => {
    const snapshot = {
      sessionId: 'sess-1',
      messages: [
        { role: 'user', content: 'hi', createdAt: '2026-01-01T00:00:00.000Z' },
        { role: 'assistant', content: 'hello', createdAt: '2026-01-01T00:00:01.000Z' },
      ],
    };
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'mem',
            type: 'aiMemory',
            name: 'Memory',
            position: { x: 0, y: 0 },
            parameters: { sessionId: 'sess-1', maxTurns: 20 },
          },
        ],
      },
      'mem',
      {
        mem: {
          status: 'success',
          agentStream: [{ type: 'satellite_memory_snapshot', ...snapshot }],
          outputItems: [[{ json: snapshot }]],
        },
      },
    );
    expect(preview).toEqual({ kind: 'single', data: [snapshot] });
  });

  it('returns only LLM answer from outputItems, not invoke input', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
      },
      'm',
      {
        m: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: [{ role: 'human', content: 'ping' }],
                  output: { content: 'pong' },
                  durationMs: 5,
                },
              },
            ],
          ],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'single',
      data: ['pong'],
    });
  });

  it('returns all satellite invoke answers as one result array', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
      },
      'm',
      {
        m: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: [{ role: 'human', content: 'q1' }],
                  output: { content: 'a1' },
                  durationMs: 10,
                },
              },
              {
                json: {
                  input: [{ role: 'human', content: 'q2' }],
                  output: { content: 'a2' },
                  durationMs: 20,
                },
              },
            ],
          ],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'single',
      data: ['a1', 'a2'],
    });
  });

  it('backfills Chat Model answers from each hub agent output item', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'agt',
            type: 'aiAgent',
            name: 'Agent',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 'm', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        ],
      },
      'm',
      {
        agt: {
          status: 'success',
          outputItems: [
            [
              { json: { answer: '{"answer":"intro"}' } },
              { json: { answer: '{"answer":"#include <iostream>"}' } },
            ],
          ],
        },
        m: {
          status: 'success',
          outputItems: [
            [
              { json: { durationMs: 10 } },
              { json: { durationMs: 20 } },
            ],
          ],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'single',
      data: ['{"answer":"intro"}', '{"answer":"#include <iostream>"}'],
    });
  });

  it('omits duration-only Chat Model invocations from output preview', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
      },
      'm',
      {
        m: {
          status: 'success',
          outputItems: [
            [
              { json: { durationMs: 10383 } },
              { json: { durationMs: 18362 } },
            ],
          ],
        },
      },
    );
    expect(preview).toBeNull();
  });

  it('returns Chat Model LLM output from satellite agentStream', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
      },
      'm',
      {
        m: {
          status: 'success',
          agentStream: [
            { type: 'satellite_invoke_start', input: [{ role: 'user', content: 'hi' }] },
            { type: 'satellite_invoke_end', output: { content: 'hello' }, durationMs: 12 },
          ],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'single',
      data: ['hello'],
    });
  });

  it('returns separate branches for IF node outputs', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          { id: 'if1', type: 'if', name: 'IF', position: { x: 0, y: 0 }, parameters: {} },
        ],
      },
      'if1',
      {
        if1: {
          status: 'success',
          outputItems: [
            [{ json: { ok: true } }],
            [{ json: { ok: false } }],
          ],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'branches',
      branches: [
        { label: 'true', data: [{ ok: true }] },
        { label: 'false', data: [{ ok: false }] },
      ],
    });
  });

  it('maps Loop done branch to outputItems index 1', () => {
    const preview = resolveNodeOutputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          { id: 'loop1', type: 'loop', name: 'Loop', position: { x: 0, y: 0 }, parameters: {} },
        ],
      },
      'loop1',
      {
        loop1: {
          status: 'success',
          outputItems: [[], [{ json: { a: 0 } }, { json: { a: 1 } }]],
        },
      },
    );
    expect(preview).toEqual({
      kind: 'branches',
      branches: [
        { label: 'done', data: [{ a: 0 }, { a: 1 }] },
        { label: 'loop', data: [] },
      ],
    });
  });
});

describe('resolveNodeInputPreview', () => {
  it('returns agentUpstream and toolArguments for tool satellite', () => {
    const input = resolveNodeInputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'code',
            type: 'code',
            name: 'Code',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'agt',
            type: 'aiAgent',
            name: 'Agent',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'tool',
            type: 'toolMcp',
            name: 'ListDir',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 'a', to: 'code' },
          { from: 'code', to: 'agt' },
          { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
        ],
      },
      'tool',
      {},
      {
        code: {
          status: 'success',
          outputItems: [[{ json: { prompt: 'hello' } }]],
        },
        tool: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: { path: '/tmp' },
                  output: { ok: true },
                  durationMs: 3,
                },
              },
            ],
          ],
        },
      },
    );
    expect(input).toEqual({
      agentUpstream: [{ prompt: 'hello' }],
      toolArguments: { path: '/tmp' },
    });
  });

  it('returns agentUpstream and modelPrompt for chat model satellite', () => {
    const messages = [{ role: 'human', content: 'ping' }];
    const input = resolveNodeInputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'code',
            type: 'code',
            name: 'Code',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'agt',
            type: 'aiAgent',
            name: 'Agent',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'm',
            type: 'aiChatModel',
            name: 'Chat Model',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 'a', to: 'code' },
          { from: 'code', to: 'agt' },
          { from: 'm', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        ],
      },
      'm',
      {},
      {
        code: {
          status: 'success',
          outputItems: [[{ json: { topic: 'greet' } }]],
        },
        m: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: messages,
                  output: { content: 'pong' },
                  durationMs: 5,
                },
              },
            ],
          ],
        },
      },
    );
    expect(input).toEqual({
      agentUpstream: [{ topic: 'greet' }],
      modelPrompt: messages,
    });
  });

  it('returns agentUpstream for memory satellite', () => {
    const input = resolveNodeInputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'code',
            type: 'code',
            name: 'Code',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'agt',
            type: 'aiAgent',
            name: 'Agent',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'mem',
            type: 'aiMemory',
            name: 'Memory',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        connections: [
          { from: 'a', to: 'code' },
          { from: 'code', to: 'agt' },
          { from: 'mem', to: 'agt', fromOutput: 'ai_memory', toInput: 'ai_memory' },
        ],
      },
      'mem',
      {},
      {
        code: {
          status: 'success',
          outputItems: [[{ json: { session: 's1' } }]],
        },
      },
    );
    expect(input).toEqual({
      agentUpstream: [{ session: 's1' }],
    });
  });

  it('returns agentUpstream for knowledge satellite', () => {
    const input = resolveNodeInputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'code',
            type: 'code',
            name: 'Code',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'agt',
            type: 'skillRun',
            name: 'Skill',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'kb',
            type: 'aiKnowledge',
            name: 'Knowledge',
            position: { x: 0, y: 0 },
            parameters: { knowledgeBaseIds: ['kb-1'] },
          },
        ],
        connections: [
          { from: 'a', to: 'code' },
          { from: 'code', to: 'agt' },
          { from: 'kb', to: 'agt', fromOutput: 'ai_knowledge', toInput: 'ai_knowledge' },
        ],
      },
      'kb',
      {},
      {
        code: {
          status: 'success',
          outputItems: [[{ json: { question: 'what is RAG?' } }]],
        },
      },
    );
    expect(input).toEqual({
      agentUpstream: [{ question: 'what is RAG?' }],
    });
  });

  it('returns agentUpstream and parserInvoke for output parser satellite', () => {
    const schema = { type: 'object', properties: { answer: { type: 'string' } } };
    const input = resolveNodeInputPreview(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'code',
            type: 'code',
            name: 'Code',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'agt',
            type: 'aiAgent',
            name: 'Agent',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'p',
            type: 'aiOutputParser',
            name: 'Parser',
            position: { x: 0, y: 0 },
            parameters: { jsonSchema: schema },
          },
        ],
        connections: [
          { from: 'a', to: 'code' },
          { from: 'code', to: 'agt' },
          { from: 'p', to: 'agt', fromOutput: 'ai_outputParser', toInput: 'ai_outputParser' },
        ],
      },
      'p',
      {},
      {
        code: {
          status: 'success',
          outputItems: [[{ json: { prompt: 'hello' } }]],
        },
        p: {
          status: 'success',
          agentStream: [{ type: 'satellite_schema_read', schema }],
        },
      },
    );
    expect(input).toEqual({
      agentUpstream: [{ prompt: 'hello' }],
      parserInvoke: { schema },
    });
  });

  it('returns webhook trigger POST body as input in execution replay', () => {
    const input = resolveNodeInputPreview(
      {
        schemaVersion: 1,
        name: 'w',
        nodes: [
          {
            id: 'wh',
            type: 'webhookTrigger',
            name: 'Webhook',
            position: { x: 0, y: 0 },
            parameters: { path: 'hook', body: { example: true } },
          },
        ],
        connections: [],
      },
      'wh',
      {},
      {},
    );
    expect(input).toEqual([{ example: true }]);
  });

  it('resolves Loop done-branch input for downstream nodes via pinBranchData', () => {
    const input = resolveNodeInputPreview(
      {
        schemaVersion: 1,
        name: 'loop',
        nodes: [
          {
            id: 'loop1',
            type: 'loop',
            name: 'Loop',
            position: { x: 0, y: 0 },
            parameters: { batchSize: 1 },
          },
          {
            id: 'cmd2',
            type: 'executeCommand',
            name: 'Execute Command 2',
            position: { x: 100, y: 0 },
            parameters: {},
          },
        ],
        connections: [{ from: 'loop1', to: 'cmd2', fromOutput: '1' }],
      },
      'cmd2',
      {},
      {
        loop1: {
          status: 'success',
          outputItems: [[], [{ json: { stdout: 'a' } }, { json: { stdout: 'b' } }]],
        },
      },
      null,
      {
        loop1: [[], [{ json: { stdout: 'a' } }, { json: { stdout: 'b' } }]],
      },
    );
    expect(input).toEqual([{ stdout: 'a' }, { stdout: 'b' }]);
  });

  it('prefers stored inputPreview from debug execution', () => {
    const input = resolveNodeInputPreview(
      def,
      'c',
      {},
      {
        c: {
          status: 'success',
          inputPreview: [{ json: { fromRun: true } }],
        },
      },
    );
    expect(input).toEqual([{ fromRun: true }]);
  });
});

describe('formatLogTimestamp', () => {
  it('formats ISO timestamps with local locale and milliseconds', () => {
    const iso = '2026-05-23T12:34:56.789Z';
    expect(formatLogTimestamp(iso)).toBe(
      new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      }),
    );
  });

  it('returns original string when parsing fails', () => {
    expect(formatLogTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('listExecutedNodes', () => {
  it('returns nodes with running, success, or failed status in runSeq order', () => {
    const nodeDebug = {
      a: { status: 'success' as const, durationMs: 12, runId: 'run-1', runSeq: 2 },
      b: { status: 'running' as const, runId: 'run-1', runSeq: 1 },
      c: { status: 'failed' as const, errorMessage: 'x', runId: 'run-1', runSeq: 3 },
      d: { status: 'idle' as const },
    };
    expect(listExecutedNodes(def, nodeDebug, 'run-1')).toEqual([
      { id: 'b', listKey: 'b', name: 'Set A', type: 'set', status: 'running' },
      {
        id: 'a',
        listKey: 'a',
        name: 'Manual',
        type: 'manualTrigger',
        status: 'success',
        durationMs: 12,
      },
      { id: 'c', listKey: 'c', name: 'Code', type: 'code', status: 'failed' },
    ]);
  });

  it('excludes nodes without debug state or idle status', () => {
    expect(listExecutedNodes(def, {})).toEqual([]);
    expect(listExecutedNodes(def, { d: { status: 'idle' } })).toEqual([]);
  });

  it('filters to current run id when provided', () => {
    const nodeDebug = {
      a: { status: 'success' as const, runId: 'run-1', runSeq: 1 },
      b: { status: 'success' as const, runId: 'run-2', runSeq: 1 },
      c: { status: 'failed' as const, runId: 'run-1', runSeq: 2 },
    };
    expect(listExecutedNodes(def, nodeDebug, 'run-1').map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('falls back to definition order when runSeq is missing', () => {
    const nodeDebug = {
      c: { status: 'failed' as const, runId: 'run-1' },
      a: { status: 'success' as const, runId: 'run-1' },
    };
    expect(listExecutedNodes(def, nodeDebug, 'run-1').map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('expands loop body nodes into one list entry per iteration', () => {
    const nodeDebug = {
      cmd: {
        status: 'success' as const,
        runId: 'run-1',
        runSeq: 2,
        loopIterations: [
          {
            round: 1,
            inputItems: [{ json: { a: 0 } }],
            outputItems: [[{ json: { out: 0 } }]],
            durationMs: 5,
          },
          {
            round: 2,
            inputItems: [{ json: { a: 1 } }],
            outputItems: [[{ json: { out: 1 } }]],
            durationMs: 7,
          },
        ],
      },
    };
    const listed = listExecutedNodes(
      {
        ...def,
        nodes: [
          ...def.nodes,
          {
            id: 'cmd',
            type: 'executeCommand',
            name: 'Execute Command',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
      },
      nodeDebug,
      'run-1',
    );
    expect(listed).toHaveLength(2);
    expect(listed[0]?.name).toBe('Execute Command (1/2)');
    expect(listed[1]?.name).toBe('Execute Command (2/2)');
    expect(listed[0]?.iterationRound).toBe(1);
  });
});

describe('resolveNodeErrorPreview', () => {
  it('aggregates code, message, invocation and agent stream errors', () => {
    const detail = resolveNodeErrorPreview({
      status: 'failed',
      errorCode: 'E3001',
      errorMessage: 'fetch failed\nCaused by: connect ECONNREFUSED 127.0.0.1:11434',
      outputItems: [
        [
          {
            json: {
              input: [{ role: 'user', content: 'hi' }],
              error: 'fetch failed\nCaused by: connect ECONNREFUSED 127.0.0.1:11434',
              durationMs: 42,
            },
          },
        ],
      ],
      agentStream: [
        { type: 'satellite_invoke_start', input: [{ role: 'user', content: 'hi' }] },
        {
          type: 'satellite_invoke_end',
          error: 'fetch failed\nCaused by: connect ECONNREFUSED 127.0.0.1:11434',
          durationMs: 42,
        },
      ],
      logs: [{ level: 'error', message: 'model unreachable', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    expect(detail).toMatchObject({
      code: 'E3001',
      message: expect.stringContaining('ECONNREFUSED'),
      invocations: [{ error: expect.stringContaining('ECONNREFUSED'), durationMs: 42 }],
      logs: [{ message: 'model unreachable' }],
    });
  });
});
