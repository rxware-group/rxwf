import { describe, expect, it } from 'vitest';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import type { WorkflowDefinition } from '../../api/client.js';
import {
  buildAgentChatModelInputSources,
  buildAgentKnowledgeInputSources,
  buildAgentMemoryInputSources,
  buildAgentOutputParserInputSources,
  buildAgentToolInputSources,
  findAgentChatModelHub,
  findAgentKnowledgeHub,
  findAgentMemoryHub,
  findAgentOutputParserHub,
  findAgentToolHub,
  hasModelInvokeData,
  hasParserInvokeData,
  hasToolInvokeData,
  MODEL_INVOKE_SOURCE_ID,
  OUTPUT_PARSER_INVOKE_SOURCE_ID,
  resolveDefaultAgentChatModelSourceId,
  resolveDefaultAgentKnowledgeSourceId,
  resolveDefaultAgentMemorySourceId,
  resolveDefaultAgentOutputParserSourceId,
  resolveDefaultAgentToolSourceId,
  TOOL_INVOKE_SOURCE_ID,
} from './agent-tool-input-sources.js';

const labels = getLocaleBundle('zh-CN');

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'tool-input',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'code',
      type: 'code',
      name: 'Code',
      position: { x: 100, y: 0 },
      parameters: {},
    },
    {
      id: 'agt',
      type: 'aiAgent',
      name: 'Agent',
      position: { x: 200, y: 0 },
      parameters: {},
    },
    {
      id: 'tool',
      type: 'toolMcp',
      name: 'ListDir',
      position: { x: 200, y: 80 },
      parameters: {},
    },
  ],
  connections: [
    { from: 't', to: 'code' },
    { from: 'code', to: 'agt' },
    { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ],
};

describe('agent-tool-input-sources', () => {
  it('findAgentToolHub returns aiAgent hub for tool satellite', () => {
    expect(findAgentToolHub(definition, 'tool')).toEqual({
      id: 'agt',
      name: 'Agent',
      type: 'aiAgent',
    });
    expect(findAgentToolHub(definition, 'agt')).toBeNull();
  });

  it('buildAgentToolInputSources includes hub predecessors and tool invoke args', () => {
    const sources = buildAgentToolInputSources({
      definition,
      toolNodeId: 'tool',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
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
    });
    expect(sources.map((s) => s.id)).toEqual(['t', 'code', TOOL_INVOKE_SOURCE_ID]);
    expect(sources[1]?.items[0]?.json).toEqual({ prompt: 'hello' });
    expect(sources[2]?.items[0]?.json).toEqual({ path: '/tmp' });
    expect(hasToolInvokeData({ outputItems: [[{ json: { input: { x: 1 } } }]] })).toBe(
      true,
    );
  });

  it('resolveDefaultAgentToolSourceId prefers tool invoke when present', () => {
    const sources = buildAgentToolInputSources({
      definition,
      toolNodeId: 'tool',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        tool: {
          status: 'success',
          outputItems: [[{ json: { input: { q: 1 }, output: {} } }]],
        },
      },
    });
    expect(resolveDefaultAgentToolSourceId(sources, definition, 'agt')).toBe(
      TOOL_INVOKE_SOURCE_ID,
    );
  });

  it('resolveDefaultAgentToolSourceId falls back to direct hub predecessor', () => {
    const sources = buildAgentToolInputSources({
      definition,
      toolNodeId: 'tool',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {},
    });
    expect(resolveDefaultAgentToolSourceId(sources, definition, 'agt')).toBe('code');
  });
});

const modelDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'model-input',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'code',
      type: 'code',
      name: 'Code',
      position: { x: 100, y: 0 },
      parameters: {},
    },
    {
      id: 'agt',
      type: 'aiAgent',
      name: 'Agent',
      position: { x: 200, y: 0 },
      parameters: {},
    },
    {
      id: 'model',
      type: 'aiChatModel',
      name: 'Chat Model',
      position: { x: 200, y: 80 },
      parameters: {},
    },
  ],
  connections: [
    { from: 't', to: 'code' },
    { from: 'code', to: 'agt' },
    { from: 'model', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
  ],
};

describe('agent-chat-model-input-sources', () => {
  it('findAgentChatModelHub returns aiAgent hub for chat model satellite', () => {
    expect(findAgentChatModelHub(modelDefinition, 'model')).toEqual({
      id: 'agt',
      name: 'Agent',
      type: 'aiAgent',
    });
    expect(findAgentChatModelHub(modelDefinition, 'agt')).toBeNull();
  });

  it('buildAgentChatModelInputSources includes hub predecessors and model prompts', () => {
    const messages = [
      { role: 'system', content: '你是工程师' },
      { role: 'user', content: '你好' },
    ];
    const sources = buildAgentChatModelInputSources({
      definition: modelDefinition,
      modelNodeId: 'model',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        code: {
          status: 'success',
          outputItems: [[{ json: { prompt: 'hello' } }]],
        },
        model: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: messages,
                  output: { content: '你好！' },
                  durationMs: 12,
                },
              },
            ],
          ],
        },
      },
    });
    expect(sources.map((s) => s.id)).toEqual(['t', 'code', MODEL_INVOKE_SOURCE_ID]);
    expect(sources[1]?.items[0]?.json).toEqual({ prompt: 'hello' });
    expect(sources[2]?.items[0]?.json).toEqual({ messages });
    expect(hasModelInvokeData({ outputItems: [[{ json: { input: messages } }]] })).toBe(true);
  });

  it('resolveDefaultAgentChatModelSourceId prefers model invoke when present', () => {
    const sources = buildAgentChatModelInputSources({
      definition: modelDefinition,
      modelNodeId: 'model',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        model: {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  input: [{ role: 'human', content: 'ping' }],
                  output: { content: 'pong' },
                },
              },
            ],
          ],
        },
      },
    });
    expect(resolveDefaultAgentChatModelSourceId(sources, modelDefinition, 'agt')).toBe(
      MODEL_INVOKE_SOURCE_ID,
    );
  });

  it('resolveDefaultAgentChatModelSourceId falls back to direct hub predecessor', () => {
    const sources = buildAgentChatModelInputSources({
      definition: modelDefinition,
      modelNodeId: 'model',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {},
    });
    expect(resolveDefaultAgentChatModelSourceId(sources, modelDefinition, 'agt')).toBe('code');
  });
});

const memoryDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'memory-input',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'code',
      type: 'code',
      name: 'Code',
      position: { x: 100, y: 0 },
      parameters: {},
    },
    {
      id: 'agt',
      type: 'skillRun',
      name: 'Skill',
      position: { x: 200, y: 0 },
      parameters: {},
    },
    {
      id: 'memory',
      type: 'aiMemory',
      name: 'Memory',
      position: { x: 200, y: 80 },
      parameters: {},
    },
  ],
  connections: [
    { from: 't', to: 'code' },
    { from: 'code', to: 'agt' },
    { from: 'memory', to: 'agt', fromOutput: 'ai_memory', toInput: 'ai_memory' },
  ],
};

const knowledgeDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'knowledge-input',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'code',
      type: 'code',
      name: 'Code',
      position: { x: 100, y: 0 },
      parameters: {},
    },
    {
      id: 'agt',
      type: 'aiAgent',
      name: 'Agent',
      position: { x: 200, y: 0 },
      parameters: {},
    },
    {
      id: 'kb',
      type: 'aiKnowledge',
      name: 'Knowledge',
      position: { x: 200, y: 80 },
      parameters: { knowledgeBaseIds: ['kb-1'] },
    },
  ],
  connections: [
    { from: 't', to: 'code' },
    { from: 'code', to: 'agt' },
    { from: 'kb', to: 'agt', fromOutput: 'ai_knowledge', toInput: 'ai_knowledge' },
  ],
};

describe('agent-knowledge-input-sources', () => {
  it('findAgentKnowledgeHub returns aiAgent hub for knowledge satellite', () => {
    expect(findAgentKnowledgeHub(knowledgeDefinition, 'kb')).toEqual({
      id: 'agt',
      name: 'Agent',
      type: 'aiAgent',
    });
    expect(findAgentKnowledgeHub(knowledgeDefinition, 'agt')).toBeNull();
  });

  it('buildAgentKnowledgeInputSources includes hub main-flow predecessors', () => {
    const sources = buildAgentKnowledgeInputSources({
      definition: knowledgeDefinition,
      knowledgeNodeId: 'kb',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        code: {
          status: 'success',
          outputItems: [[{ json: { query: 'docs' } }]],
        },
      },
    });
    expect(sources.map((s) => s.id)).toEqual(['t', 'code']);
    expect(sources[1]?.items[0]?.json).toEqual({ query: 'docs' });
  });

  it('resolveDefaultAgentKnowledgeSourceId falls back to direct hub predecessor', () => {
    const sources = buildAgentKnowledgeInputSources({
      definition: knowledgeDefinition,
      knowledgeNodeId: 'kb',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {},
    });
    expect(resolveDefaultAgentKnowledgeSourceId(sources, knowledgeDefinition, 'agt')).toBe('code');
  });
});

describe('agent-memory-input-sources', () => {
  it('findAgentMemoryHub returns skillRun hub for memory satellite', () => {
    expect(findAgentMemoryHub(memoryDefinition, 'memory')).toEqual({
      id: 'agt',
      name: 'Skill',
      type: 'skillRun',
    });
    expect(findAgentMemoryHub(memoryDefinition, 'agt')).toBeNull();
  });

  it('buildAgentMemoryInputSources includes hub main-flow predecessors', () => {
    const sources = buildAgentMemoryInputSources({
      definition: memoryDefinition,
      memoryNodeId: 'memory',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        code: {
          status: 'success',
          outputItems: [[{ json: { prompt: 'hello' } }]],
        },
      },
    });
    expect(sources.map((s) => s.id)).toEqual(['t', 'code']);
    expect(sources[1]?.items[0]?.json).toEqual({ prompt: 'hello' });
  });

  it('resolveDefaultAgentMemorySourceId falls back to direct hub predecessor', () => {
    const sources = buildAgentMemoryInputSources({
      definition: memoryDefinition,
      memoryNodeId: 'memory',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {},
    });
    expect(resolveDefaultAgentMemorySourceId(sources, memoryDefinition, 'agt')).toBe('code');
  });
});

const parserDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'parser-input',
  nodes: [
    {
      id: 't',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'code',
      type: 'code',
      name: 'Code',
      position: { x: 100, y: 0 },
      parameters: {},
    },
    {
      id: 'agt',
      type: 'aiAgent',
      name: 'Agent',
      position: { x: 200, y: 0 },
      parameters: {},
    },
    {
      id: 'parser',
      type: 'aiOutputParser',
      name: 'Parser',
      position: { x: 200, y: 80 },
      parameters: {
        jsonSchema: { type: 'object', properties: { answer: { type: 'string' } } },
      },
    },
  ],
  connections: [
    { from: 't', to: 'code' },
    { from: 'code', to: 'agt' },
    { from: 'parser', to: 'agt', fromOutput: 'ai_outputParser', toInput: 'ai_outputParser' },
  ],
};

describe('agent-output-parser-input-sources', () => {
  it('findAgentOutputParserHub returns aiAgent hub for output parser satellite', () => {
    expect(findAgentOutputParserHub(parserDefinition, 'parser')).toEqual({
      id: 'agt',
      name: 'Agent',
      type: 'aiAgent',
    });
    expect(findAgentOutputParserHub(parserDefinition, 'agt')).toBeNull();
  });

  it('buildAgentOutputParserInputSources includes hub predecessors and parser schema invoke', () => {
    const schema = { type: 'object', properties: { answer: { type: 'string' } } };
    const sources = buildAgentOutputParserInputSources({
      definition: parserDefinition,
      parserNodeId: 'parser',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        code: {
          status: 'success',
          outputItems: [[{ json: { prompt: 'hello' } }]],
        },
        parser: {
          status: 'success',
          agentStream: [{ type: 'satellite_schema_read', schema }],
          outputItems: [[{ json: { schema } }]],
        },
      },
    });
    expect(sources.map((s) => s.id)).toEqual(['t', 'code', OUTPUT_PARSER_INVOKE_SOURCE_ID]);
    expect(sources[1]?.items[0]?.json).toEqual({ prompt: 'hello' });
    expect(sources[2]?.items[0]?.json).toEqual({ schema });
    expect(hasParserInvokeData({ agentStream: [{ type: 'satellite_schema_read', schema }] })).toBe(
      true,
    );
  });

  it('resolveDefaultAgentOutputParserSourceId prefers parser invoke when present', () => {
    const schema = { type: 'object' };
    const sources = buildAgentOutputParserInputSources({
      definition: parserDefinition,
      parserNodeId: 'parser',
      hubId: 'agt',
      labels,
      pinData: {},
      nodeDebug: {
        parser: {
          status: 'success',
          outputItems: [[{ json: { schema } }]],
        },
      },
    });
    expect(resolveDefaultAgentOutputParserSourceId(sources, parserDefinition, 'agt')).toBe(
      OUTPUT_PARSER_INVOKE_SOURCE_ID,
    );
  });
});
