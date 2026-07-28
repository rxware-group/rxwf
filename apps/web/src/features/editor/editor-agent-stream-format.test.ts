import { describe, expect, it } from 'vitest';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { t } from '../../i18n/labels.js';
import {
  enrichSatelliteAgentStreamForDisplay,
  formatAgentStreamLine,
} from './editor-agent-stream-format.js';

const labels = getLocaleBundle('zh-CN');

describe('formatAgentStreamLine', () => {
  it('formats crew supervisor agent_step', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: {
        supervisor: 'Supervisor',
        stepIndex: 0,
        decision: { action: 'run', member: 'Researcher', task: 'go' },
      },
    });
    expect(line.label).toContain('Supervisor');
    expect(line.label).toContain('Researcher');
  });

  it('formats crew worker running step', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: { crewMember: 'Researcher', status: 'running', task: 'analyze' },
    });
    expect(line.label).toContain(labels['timeline.running']?.replace('{name}', 'Researcher') ?? '执行中');
    expect(line.detail).toContain('analyze');
  });

  it('formats Output Parser schema_read as 读取 Schema', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'satellite_schema_read',
      schema: { type: 'object', properties: { answer: { type: 'string' } } },
    });
    expect(line.label).toBe(t(labels, 'editor.satelliteSchemaRead'));
    expect(line.detail).toContain('"answer"');
  });

  it('formats mirrored Chat Model invoke on hub agent log', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: {
        kind: 'chatModel',
        phase: 'start',
        satelliteNodeName: 'Chat Model',
        input: [{ role: 'user', content: 'hello' }],
      },
    });
    expect(line.label).toContain('Chat Model');
    expect(line.detail).toContain('hello');
  });

  it('formats structured output failure with diagnostic payload', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: {
        kind: 'structuredOutputFailed',
        errorCode: 'E3013',
        userMessage: 'hi',
        answer: '(empty)',
        error: 'Agent returned empty answer for structured output',
      },
    });
    expect(line.label).toContain('E3013');
    expect(line.detail).toContain('(empty)');
    expect(line.detail).toContain('Agent returned empty answer');
  });

  it('formats Chat Model satellite_invoke_end with answer detail', () => {
    const line = formatAgentStreamLine(
      labels,
      {
        type: 'satellite_invoke_end',
        output: { content: 'Hello World' },
        durationMs: 13609,
      },
      { nodeType: 'aiChatModel', nodeName: 'Chat Model 1' },
    );
    expect(line.label).toContain('Chat Model 1');
    expect(line.label).toContain('13609');
    expect(line.detail).toBe('Hello World');
  });

  it('backfills missing satellite_invoke_end output from debug outputItems', () => {
    const enriched = enrichSatelliteAgentStreamForDisplay(
      [
        { type: 'satellite_invoke_start', input: [{ role: 'human', content: 'hi' }] },
        { type: 'satellite_invoke_end', durationMs: 12 },
      ],
      {
        status: 'success',
        outputItems: [
          [
            {
              json: {
                input: [{ role: 'human', content: 'hi' }],
                output: { content: 'pong' },
                durationMs: 12,
              },
            },
          ],
        ],
      },
    );
    expect(enriched[1]?.output).toEqual({ content: 'pong' });
    const line = formatAgentStreamLine(labels, enriched[1]!, {
      nodeType: 'aiChatModel',
      nodeName: 'Model',
    });
    expect(line.detail).toBe('pong');
  });

  it('does not truncate satellite invoke input in log detail', () => {
    const longSchema = 'x'.repeat(500);
    const line = formatAgentStreamLine(labels, {
      type: 'satellite_invoke_start',
      input: [{ role: 'system', content: longSchema }],
    });
    expect(line.detail).toContain(longSchema);
    expect(line.detail).not.toContain('…');
  });

  it('formats knowledge retrieval with chunk text in agent stream', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'satellite_knowledge_query',
      query: '你是谁？',
      knowledgeBaseIds: ['kb-1'],
      chunks: [
        {
          text: '我是智能助手。',
          score: 0.92,
          documentName: 'faq.md',
          knowledgeBaseId: 'kb-1',
          documentId: 'd1',
          chunkIndex: 0,
        },
      ],
    });
    expect(line.label).toContain('1');
    expect(line.detail).toContain('你是谁？');
    expect(line.detail).toContain('faq.md');
    expect(line.detail).toContain('我是智能助手。');
  });

  it('formats mirrored hub knowledge agent_step with chunk text', () => {
    const line = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: {
        kind: 'knowledge',
        satelliteNodeName: 'Knowledge',
        query: '是否支持Mate X？',
        chunkCount: 1,
        chunks: [
          {
            text: '支持 Mate X 系列。',
            score: 0.88,
            documentName: 'devices.md',
            knowledgeBaseId: 'kb-1',
            documentId: 'd2',
            chunkIndex: 3,
          },
        ],
      },
    });
    expect(line.label).toContain('1');
    expect(line.detail).toContain('是否支持Mate X？');
    expect(line.detail).toContain('devices.md');
    expect(line.detail).toContain('支持 Mate X 系列。');
  });

  it('formats subagent inner run and satellite steps', () => {
    const start = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: { kind: 'subagentRunStart', userMessage: 'review code' },
    });
    expect(start.label).toBe(t(labels, 'editor.subagentRunStart'));
    expect(start.detail).toBe('review code');

    const satellite = formatAgentStreamLine(labels, {
      type: 'agent_step',
      step: {
        kind: 'subagentSatellite',
        phase: 'end',
        satelliteNodeName: 'ReadFile',
        output: { content: 'src/main.ts' },
        durationMs: 15,
      },
    });
    expect(satellite.label).toContain('ReadFile');
    expect(satellite.label).toContain('15');
    expect(satellite.detail).toBe('src/main.ts');
  });
});
