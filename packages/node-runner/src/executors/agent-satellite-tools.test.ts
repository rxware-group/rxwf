import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AwfError } from '@rxwf/shared';
import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import { isSatelliteNodeType, SATELLITE_NODE_TYPES, type WorkflowNode } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { getNodeRunnerRequirements } from '../node-runner-requirements.js';
import {
  buildAgentToolDefinitions,
  invokeAgentTool,
  isAgentSatelliteToolSource,
  modelFromChatModelNode,
  outputSchemaFromParserNode,
  parseOutputParserAnswer,
} from './agent-satellite-tools.js';
import { registerPlusExecutors } from './register-plus.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const aiChatModelAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/aiChatModel.md');
const aiMemoryAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/aiMemory.md');
const aiOutputParserAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/aiOutputParser.md');
const toolReadAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolRead.md');
const toolWriteAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolWrite.md');
const toolGrepAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolGrep.md');
const toolHttpAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolHttp.md');
const toolMcpAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolMcp.md');
const toolWebSearchAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolWebSearch.md');
const toolShellAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolShell.md');

describe('aiChatModel satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('aiChatModel')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('aiChatModel')).toBe(true);
  });

  it('throws E2003 when aiChatModel executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('aiChatModel')).toBe(false);
    await expect(
      registry.execute('aiChatModel', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('modelFromChatModelNode', () => {
  it('defaults to ollama llama3 when parameters are empty', () => {
    expect(modelFromChatModelNode({})).toEqual({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: undefined,
      credentialId: undefined,
    });
  });

  it('maps openai-compatible parameters including baseUrl and credentialId', () => {
    expect(
      modelFromChatModelNode({
        provider: 'openai-compatible',
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.example.com/v1',
        credentialId: 'cred-1',
      }),
    ).toEqual({
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.example.com/v1',
      credentialId: 'cred-1',
    });
  });
});

describe('aiChatModel M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(aiChatModelAuditRowPath)).toBe(true);
    const content = readFileSync(aiChatModelAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-aiChatModel');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-aiChatModel');
    expect(content).toContain('E1043');
    expect(content).toContain('E1012');
    expect(content).toContain('E3001');
  });
});

describe('aiMemory satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('aiMemory')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('aiMemory')).toBe(true);
  });

  it('throws E2003 when aiMemory executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('aiMemory')).toBe(false);
    await expect(
      registry.execute('aiMemory', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('aiMemory M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(aiMemoryAuditRowPath)).toBe(true);
    const content = readFileSync(aiMemoryAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-aiMemory');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-aiMemory');
    expect(content).toContain('E1014');
    expect(content).toContain('W1010');
  });
});

describe('aiOutputParser satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('aiOutputParser')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('aiOutputParser')).toBe(true);
  });

  it('throws E2003 when aiOutputParser executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('aiOutputParser')).toBe(false);
    await expect(
      registry.execute('aiOutputParser', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('aiOutputParser M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(aiOutputParserAuditRowPath)).toBe(true);
    const content = readFileSync(aiOutputParserAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-aiOutputParser');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-aiOutputParser');
    expect(content).toContain('E3013');
    expect(content).toContain('E1014');
    expect(content).toContain('W1010');
  });
});

describe('outputSchemaFromParserNode', () => {
  const baseParser: WorkflowNode = {
    id: 'parser',
    type: 'aiOutputParser',
    name: 'Parser',
    position: { x: 0, y: 0 },
    parameters: {},
  };

  it('reads object jsonSchema from parameters', () => {
    const schema = {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
    };
    expect(
      outputSchemaFromParserNode({
        ...baseParser,
        parameters: { jsonSchema: schema },
      }),
    ).toEqual(schema);
  });

  it('parses string jsonSchema from parameters', () => {
    const schema = { type: 'object', properties: { n: { type: 'number' } } };
    expect(
      outputSchemaFromParserNode({
        ...baseParser,
        parameters: { jsonSchema: JSON.stringify(schema) },
      }),
    ).toEqual(schema);
  });

  it('returns undefined for invalid string jsonSchema', () => {
    expect(
      outputSchemaFromParserNode({
        ...baseParser,
        parameters: { jsonSchema: '{ not-json' },
      }),
    ).toBeUndefined();
  });
});

describe('parseOutputParserAnswer', () => {
  const parserNode: WorkflowNode = {
    id: 'parser',
    type: 'aiOutputParser',
    name: 'Parser',
    position: { x: 0, y: 0 },
    parameters: {
      jsonSchema: {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
    },
  };

  it('parses JSON answer matching schema', () => {
    expect(parseOutputParserAnswer('{"answer":"ok"}', parserNode)).toEqual({ answer: 'ok' });
  });

  it('parses JSON inside markdown code block', () => {
    expect(parseOutputParserAnswer('```json\n{"answer":"ok"}\n```', parserNode)).toEqual({
      answer: 'ok',
    });
  });

  it('throws E3013 when jsonSchema is missing', () => {
    expect(() =>
      parseOutputParserAnswer('{"answer":"ok"}', {
        ...parserNode,
        parameters: {},
      }),
    ).toThrowError(expect.objectContaining({ code: 'E3013' }));
  });

  it('throws E3013 when answer is not valid JSON', () => {
    expect(() => parseOutputParserAnswer('not json', parserNode)).toThrowError(
      expect.objectContaining({ code: 'E3013' }),
    );
  });

  it('throws E3013 when required property is missing', () => {
    expect(() => parseOutputParserAnswer('{"other":"x"}', parserNode)).toThrowError(
      expect.objectContaining({ code: 'E3013' }),
    );
  });
});

describe('toolRead satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolRead')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolRead')).toBe(true);
  });

  it('throws E2003 when toolRead executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolRead')).toBe(false);
    await expect(
      registry.execute('toolRead', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolRead M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolReadAuditRowPath)).toBe(true);
    const content = readFileSync(toolReadAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolRead');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolRead');
    expect(content).toContain('E1056');
    expect(content).toContain('E1041');
  });
});

describe('toolWebSearch satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolWebSearch')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolWebSearch')).toBe(true);
  });

  it('throws E2003 when toolWebSearch executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolWebSearch')).toBe(false);
    await expect(
      registry.execute('toolWebSearch', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolWebSearch M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolWebSearchAuditRowPath)).toBe(true);
    const content = readFileSync(toolWebSearchAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolWebSearch');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolWebSearch');
    expect(content).toContain('E1071');
    expect(content).toContain('E1072');
    expect(content).toContain('E1073');
    expect(content).toContain('E1074');
  });
});

describe('toolGrep satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolGrep')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolGrep')).toBe(true);
  });

  it('throws E2003 when toolGrep executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolGrep')).toBe(false);
    await expect(
      registry.execute('toolGrep', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolGrep M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolGrepAuditRowPath)).toBe(true);
    const content = readFileSync(toolGrepAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolGrep');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolGrep');
    expect(content).toContain('E1056');
    expect(content).toContain('E2002');
    expect(content).toContain('E1041');
  });
});

describe('toolWrite satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolWrite')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolWrite')).toBe(true);
  });

  it('throws E2003 when toolWrite executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolWrite')).toBe(false);
    await expect(
      registry.execute('toolWrite', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolWrite M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolWriteAuditRowPath)).toBe(true);
    const content = readFileSync(toolWriteAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolWrite');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolWrite');
    expect(content).toContain('E1056');
    expect(content).toContain('E2002');
    expect(content).toContain('E1041');
  });
});

describe('toolShell satellite', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolShell')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolShell')).toBe(true);
  });

  it('throws E2003 when toolShell executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolShell')).toBe(false);
    await expect(
      registry.execute('toolShell', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolShell M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolShellAuditRowPath)).toBe(true);
    const content = readFileSync(toolShellAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolShell');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolShell');
    expect(content).toContain('E1057');
    expect(content).toContain('E2002');
    expect(content).toContain('E3012');
  });
});

describe('buildAgentToolDefinitions', () => {
  it('registers toolRead with filesystem read source', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'r1',
        type: 'toolRead',
        name: 'read_file',
        position: { x: 0, y: 0 },
        parameters: { toolDescription: 'Read a file' },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({
      type: 'filesystem',
      operation: 'read',
      toolNodeId: 'r1',
    });
  });

  it('uses built-in description when toolDescription is omitted for toolRead', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'r1',
        type: 'toolRead',
        name: 'read_file',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    expect(buildAgentToolDefinitions(nodes)[0]?.description).toContain('读取');
    expect(buildAgentToolDefinitions(nodes, { locale: 'en-US' })[0]?.description).toContain(
      'Read a text file',
    );
  });

  it('registers toolRead parameters with path and target_file aliases', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'r1',
        type: 'toolRead',
        name: 'read_file',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    const params = buildAgentToolDefinitions(nodes)[0]?.parameters as {
      properties?: Record<string, unknown>;
    };
    expect(params?.properties).toMatchObject({
      path: { type: 'string' },
      target_file: { type: 'string' },
    });
  });

  it('uses child workflow schema for toolWorkflow when inputMapping empty', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'tw1',
        type: 'toolWorkflow',
        name: 'RunChild',
        position: { x: 0, y: 0 },
        parameters: {
          workflowId: 'child-1',
          toolDescription: 'Run child',
          inputMapping: {},
        },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes, {
      childWorkflowSchemas: new Map([
        [
          'child-1',
          {
            mode: 'fields',
            fields: [{ name: 'query', type: 'string', required: true, description: 'Search' }],
            jsonSchema: {
              type: 'object',
              required: ['query'],
              properties: { query: { type: 'string', description: 'Search' } },
            },
          },
        ],
      ]),
    });
    expect(tools[0]?.parameters).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', description: 'Search' } },
    });
  });

  it('registers toolWebSearch with web_search source', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'ws1',
        type: 'toolWebSearch',
        name: 'web_search',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({ type: 'web_search', toolNodeId: 'ws1' });
    expect(tools[0]?.parameters).toMatchObject({
      type: 'object',
      properties: {
        query: { type: 'string' },
        q: { type: 'string' },
        maxResults: { type: 'number' },
      },
    });
  });

  it('uses built-in description when toolDescription is omitted for toolWebSearch', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'ws1',
        type: 'toolWebSearch',
        name: 'web_search',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    expect(buildAgentToolDefinitions(nodes)[0]?.description).toContain('搜索');
    expect(buildAgentToolDefinitions(nodes, { locale: 'en-US' })[0]?.description).toContain(
      'Search the web',
    );
  });

  it('registers toolGrep with filesystem grep source', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'g1',
        type: 'toolGrep',
        name: 'grep_tool',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({
      type: 'filesystem',
      operation: 'grep',
      toolNodeId: 'g1',
    });
    expect(tools[0]?.parameters).toMatchObject({
      type: 'object',
      required: ['pattern'],
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string' },
        glob: { type: 'string' },
      },
    });
  });

  it('uses built-in description when toolDescription is omitted for toolGrep', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'g1',
        type: 'toolGrep',
        name: 'grep_tool',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    expect(buildAgentToolDefinitions(nodes)[0]?.description).toContain('搜索');
    expect(buildAgentToolDefinitions(nodes, { locale: 'en-US' })[0]?.description).toContain(
      'Search file contents',
    );
  });

  it('registers toolShell with shell source and command schema', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'sh1',
        type: 'toolShell',
        name: 'run_cmd',
        position: { x: 0, y: 0 },
        parameters: { cwd: '/tmp' },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({ type: 'shell', toolNodeId: 'sh1' });
    expect(tools[0]?.parameters).toMatchObject({
      type: 'object',
      required: ['command'],
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string' },
        timeoutMs: { type: 'number' },
      },
    });
  });

  it('uses built-in description when toolDescription is omitted for toolShell', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'sh1',
        type: 'toolShell',
        name: 'run_cmd',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ];
    expect(buildAgentToolDefinitions(nodes)[0]?.description).toContain('Shell');
    expect(buildAgentToolDefinitions(nodes, { locale: 'en-US' })[0]?.description).toContain(
      'shell command',
    );
  });

  it('isAgentSatelliteToolSource recognizes shell source', () => {
    expect(isAgentSatelliteToolSource({ type: 'shell', toolNodeId: 'sh1' })).toBe(true);
  });

  it('throws when toolDescription is missing for configurable toolMcp', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'm1',
        type: 'toolMcp',
        name: 'list_dir',
        position: { x: 0, y: 0 },
        parameters: { serverId: 's1', tools: ['list_directory'] },
      },
    ];
    expect(() => buildAgentToolDefinitions(nodes)).toThrow(/toolDescription/);
  });

  it('registers toolMcp with mcp source including serverId and toolName', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'm1',
        type: 'toolMcp',
        name: 'list_dir',
        position: { x: 0, y: 0 },
        parameters: {
          serverId: 'srv-1',
          tools: ['list_directory'],
          toolDescription: 'List files in a directory',
        },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('list_dir');
    expect(tools[0]?.description).toBe('List files in a directory');
    expect(tools[0]?.source).toEqual({
      type: 'mcp',
      serverId: 'srv-1',
      toolName: 'list_directory',
    });
  });

  it('defaults toolMcp to list_directory when tools array is empty', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'm1',
        type: 'toolMcp',
        name: 'mcp_tool',
        position: { x: 0, y: 0 },
        parameters: {
          serverId: 'srv-1',
          tools: [],
          toolDescription: 'Default MCP tool',
        },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toMatchObject({ toolName: 'list_directory' });
  });

  it('registers prefixed tool names when toolMcp selects multiple MCP tools', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'm1',
        type: 'toolMcp',
        name: 'fs_tools',
        position: { x: 0, y: 0 },
        parameters: {
          serverId: 'srv-1',
          tools: ['list_directory', 'read_file'],
          toolDescription: 'Filesystem MCP tools',
        },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['fs_tools_list_directory', 'fs_tools_read_file']);
    expect(tools[0]?.source).toMatchObject({ toolName: 'list_directory' });
    expect(tools[1]?.source).toMatchObject({ toolName: 'read_file' });
  });

  it('registers toolHttp with http source including method, url, headers, and body', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'h1',
        type: 'toolHttp',
        name: 'fetch_api',
        position: { x: 0, y: 0 },
        parameters: {
          method: 'post',
          url: 'https://api.example.com/data',
          headers: { Authorization: 'Bearer x' },
          body: '{"q":"test"}',
          toolDescription: 'Fetch data from API',
        },
      },
    ];
    const tools = buildAgentToolDefinitions(nodes);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({
      type: 'http',
      method: 'POST',
      url: 'https://api.example.com/data',
      headers: { Authorization: 'Bearer x' },
      body: '{"q":"test"}',
    });
    expect(tools[0]?.description).toBe('Fetch data from API');
  });

  it('throws when toolDescription is missing for toolHttp', () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'h1',
        type: 'toolHttp',
        name: 'fetch_api',
        position: { x: 0, y: 0 },
        parameters: { method: 'GET', url: 'https://example.com' },
      },
    ];
    expect(() => buildAgentToolDefinitions(nodes)).toThrow(/toolDescription/);
  });
});

describe('toolHttp satellite registry', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolHttp')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolHttp')).toBe(true);
  });

  it('throws E2003 when toolHttp is executed via registry (no standalone executor)', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolHttp')).toBe(false);
    await expect(
      registry.execute('toolHttp', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolHttp M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolHttpAuditRowPath)).toBe(true);
    const content = readFileSync(toolHttpAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolHttp');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolHttp');
    expect(content).toContain('E2003');
    expect(content).toContain('E3012');
  });
});

describe('toolMcp satellite registry', () => {
  it('is a satellite node type without standalone executor', () => {
    expect(isSatelliteNodeType('toolMcp')).toBe(true);
    expect(SATELLITE_NODE_TYPES.has('toolMcp')).toBe(true);
  });

  it('throws E2003 when toolMcp is executed via registry (no standalone executor)', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolMcp')).toBe(false);
    await expect(
      registry.execute('toolMcp', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolMcp M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolMcpAuditRowPath)).toBe(true);
    const content = readFileSync(toolMcpAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolMcp');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolMcp');
    expect(content).toContain('E2003');
    expect(content).toContain('E3012');
    expect(content).toContain('E1001');
    expect(content).toContain('E1004');
  });
});

describe('invokeAgentTool', () => {
  it('reads a file via embedded filesystem invoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-'));
    const filePath = join(dir, 'hello.txt');
    await writeFile(filePath, 'world', 'utf8');

    const def: ToolDefinition = {
      name: 'read_file',
      description: 'Read',
      parameters: {},
      source: { type: 'filesystem', operation: 'read', toolNodeId: 'r1' },
    };

    const content = await invokeAgentTool(def, { path: filePath }, {
      scanRoots: [dir],
    });
    expect(content).toBe('world');
  });

  it('reads a file via target_file alias', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-alias-'));
    const filePath = join(dir, 'alias.txt');
    await writeFile(filePath, 'alias-content', 'utf8');

    const def: ToolDefinition = {
      name: 'read_file',
      description: 'Read',
      parameters: {},
      source: { type: 'filesystem', operation: 'read', toolNodeId: 'r1' },
    };

    const content = await invokeAgentTool(def, { target_file: filePath }, {
      scanRoots: [dir],
    });
    expect(content).toBe('alias-content');
  });

  it('throws E1056 when read path is outside scanRoots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-oob-'));
    const filePath = join(dir, 'secret.txt');
    await writeFile(filePath, 'secret', 'utf8');

    const def: ToolDefinition = {
      name: 'read_file',
      description: 'Read',
      parameters: {},
      source: { type: 'filesystem', operation: 'read', toolNodeId: 'r1' },
    };

    await expect(
      invokeAgentTool(def, { path: filePath }, { scanRoots: ['/other-root'] }),
    ).rejects.toMatchObject({ code: 'E1056' });
  });

  it('throws E1041 when read target is not a readable file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-missing-'));
    const def: ToolDefinition = {
      name: 'read_file',
      description: 'Read',
      parameters: {},
      source: { type: 'filesystem', operation: 'read', toolNodeId: 'r1' },
    };

    await expect(
      invokeAgentTool(def, { path: dir }, { scanRoots: [dir] }),
    ).rejects.toMatchObject({ code: 'E1041' });
  });

  it('writes a file via embedded filesystem invoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-write-'));
    const filePath = join(dir, 'out.txt');

    const def: ToolDefinition = {
      name: 'write_file',
      description: 'Write',
      parameters: {},
      source: { type: 'filesystem', operation: 'write', toolNodeId: 'w1' },
    };

    const result = await invokeAgentTool(
      def,
      { path: filePath, content: 'hello-write' },
      { scanRoots: [dir] },
    ) as { path?: string; bytesWritten?: number };

    expect(result.bytesWritten).toBe(Buffer.byteLength('hello-write', 'utf8'));
    await expect(readFile(filePath, 'utf8')).resolves.toBe('hello-write');
  });

  it('appends to an existing file via embedded filesystem invoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-append-'));
    const filePath = join(dir, 'append.txt');
    await writeFile(filePath, 'base', 'utf8');

    const def: ToolDefinition = {
      name: 'write_file',
      description: 'Write',
      parameters: {},
      source: { type: 'filesystem', operation: 'write', toolNodeId: 'w1' },
    };

    await invokeAgentTool(
      def,
      { path: filePath, content: '-more', append: true },
      { scanRoots: [dir] },
    );

    await expect(readFile(filePath, 'utf8')).resolves.toBe('base-more');
  });

  it('throws E2002 when write path is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-write-empty-'));
    const def: ToolDefinition = {
      name: 'write_file',
      description: 'Write',
      parameters: {},
      source: { type: 'filesystem', operation: 'write', toolNodeId: 'w1' },
    };

    await expect(
      invokeAgentTool(def, { path: '   ', content: 'x' }, { scanRoots: [dir] }),
    ).rejects.toMatchObject({ code: 'E2002' });
  });

  it('throws E1056 when write path is outside scanRoots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-tool-write-oob-'));
    const def: ToolDefinition = {
      name: 'write_file',
      description: 'Write',
      parameters: {},
      source: { type: 'filesystem', operation: 'write', toolNodeId: 'w1' },
    };

    await expect(
      invokeAgentTool(
        def,
        { path: join(dir, 'secret.txt'), content: 'x' },
        { scanRoots: ['/other-root'] },
      ),
    ).rejects.toMatchObject({ code: 'E1056' });
  });

  it('delegates to runnerGateway when agent runner is resolved', async () => {
    const invokeTool = vi.fn(async () => ({
      invokeId: 'inv-1',
      status: 'success' as const,
      result: 'remote-content',
      durationMs: 1,
    }));

    const def: ToolDefinition = {
      name: 'read_file',
      description: 'Read',
      parameters: {},
      source: { type: 'filesystem', operation: 'read', toolNodeId: 'r1' },
    };

    const content = await invokeAgentTool(def, { path: '/workspace/a.txt' }, {
      scanRoots: ['/workspace'],
      runnerGateway: { invokeTool } as never,
      resolveRunnerForToolNode: async () => ({ kind: 'agent', id: 'runner-1' }),
    });

    expect(content).toBe('remote-content');
    expect(invokeTool).toHaveBeenCalledOnce();
  });

  it('embedded shell invoke fails with E1057', async () => {
    const def: ToolDefinition = {
      name: 'run_cmd',
      description: 'Run shell',
      parameters: {},
      source: { type: 'shell', toolNodeId: 'sh1' },
    };

    await expect(
      invokeAgentTool(def, { command: 'echo hi' }, { scanRoots: ['/workspace'] }),
    ).rejects.toMatchObject({ code: 'E1057' });
  });

  it('delegates shell to runnerGateway when agent runner is resolved', async () => {
    const invokeTool = vi.fn(async () => ({
      invokeId: 'inv-shell',
      status: 'success' as const,
      result: { stdout: 'hello', exitCode: 0 },
      durationMs: 1,
    }));

    const def: ToolDefinition = {
      name: 'run_cmd',
      description: 'Run shell',
      parameters: {},
      source: { type: 'shell', toolNodeId: 'sh1' },
    };

    const result = await invokeAgentTool(
      def,
      { command: 'echo hi', cwd: '/workspace', timeoutMs: 30_000 },
      {
        scanRoots: ['/workspace'],
        runnerGateway: { invokeTool } as never,
        resolveRunnerForToolNode: async () => ({ kind: 'agent', id: 'runner-1' }),
      },
    );

    expect(result).toEqual({ stdout: 'hello', exitCode: 0 });
    expect(invokeTool).toHaveBeenCalledOnce();
    const request = (invokeTool.mock.calls[0] as [string, Record<string, unknown>] | undefined)?.[1];
    expect(request).toMatchObject({
      capability: 'shell',
      method: 'exec',
      args: { command: 'echo hi', cwd: '/workspace', timeoutMs: 30_000 },
    });
  });

  it('throws E1071 when embedded webSearch port is not configured', async () => {
    const def: ToolDefinition = {
      name: 'web_search',
      description: 'Search',
      parameters: {},
      source: { type: 'web_search', toolNodeId: 'ws1' },
    };

    await expect(
      invokeAgentTool(def, { query: 'latest news' }, { scanRoots: [] }),
    ).rejects.toMatchObject({ code: 'E1071' });
  });

  it('throws E1071 when web_search query is empty', async () => {
    const webSearch = { search: vi.fn() };
    const def: ToolDefinition = {
      name: 'web_search',
      description: 'Search',
      parameters: {},
      source: { type: 'web_search', toolNodeId: 'ws1' },
    };

    await expect(
      invokeAgentTool(def, { query: '   ' }, { scanRoots: [], webSearch }),
    ).rejects.toMatchObject({ code: 'E1071' });
    expect(webSearch.search).not.toHaveBeenCalled();
  });

  it('returns summary via embedded webSearch port', async () => {
    const webSearch = {
      search: vi.fn(async () => ({
        summary: 'embedded search summary',
        results: [{ title: 'Hit', url: 'https://example.com', snippet: 'snippet' }],
      })),
    };
    const def: ToolDefinition = {
      name: 'web_search',
      description: 'Search',
      parameters: {},
      source: { type: 'web_search', toolNodeId: 'ws1' },
    };

    const summary = await invokeAgentTool(
      def,
      { query: 'rx-workflow', maxResults: 3 },
      { scanRoots: [], webSearch },
    );

    expect(summary).toBe('embedded search summary');
    expect(webSearch.search).toHaveBeenCalledWith(
      { query: 'rx-workflow' },
      { maxResults: 3 },
    );
  });

  it('greps files via embedded filesystem invoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-grep-'));
    const filePath = join(dir, 'needle.txt');
    await writeFile(filePath, 'find the needle here\n', 'utf8');

    const def: ToolDefinition = {
      name: 'grep_tool',
      description: 'Grep',
      parameters: {},
      source: { type: 'filesystem', operation: 'grep', toolNodeId: 'g1' },
    };

    const result = await invokeAgentTool(
      def,
      { pattern: 'needle', path: dir },
      { scanRoots: [dir] },
    );
    const payload =
      typeof result === 'string' ? (JSON.parse(result) as { matches: unknown[] }) : result;
    expect(payload).toMatchObject({
      matches: expect.arrayContaining([
        expect.objectContaining({
          path: filePath,
          line: 1,
          text: 'find the needle here',
        }),
      ]),
    });
  });

  it('fails embedded grep when pattern is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-sat-grep-empty-'));
    const def: ToolDefinition = {
      name: 'grep_tool',
      description: 'Grep',
      parameters: {},
      source: { type: 'filesystem', operation: 'grep', toolNodeId: 'g1' },
    };

    await expect(
      invokeAgentTool(def, { pattern: '   ' }, { scanRoots: [dir] }),
    ).rejects.toMatchObject({
      code: 'E2002',
      message: expect.stringContaining('pattern'),
    } satisfies Partial<AwfError>);
  });

  it('delegates web_search to runnerGateway with providerConfig', async () => {
    const invokeTool = vi.fn(async () => ({
      invokeId: 'inv-ws',
      status: 'success' as const,
      result: { summary: 'remote search summary' },
      durationMs: 2,
    }));

    const def: ToolDefinition = {
      name: 'web_search',
      description: 'Search',
      parameters: {},
      source: { type: 'web_search', toolNodeId: 'ws1' },
    };

    const summary = await invokeAgentTool(def, { query: 'latest news' }, {
      scanRoots: ['/workspace'],
      runnerGateway: { invokeTool } as never,
      resolveRunnerForToolNode: async () => ({ kind: 'agent', id: 'runner-1' }),
      resolveWebSearchProviderConfig: async () => ({
        providerId: 'tavily',
        apiKey: 'tvly-relayed',
      }),
    });

    expect(summary).toBe('remote search summary');
    expect(invokeTool).toHaveBeenCalledOnce();
    const request = (invokeTool.mock.calls[0] as [string, Record<string, unknown>] | undefined)?.[1];
    expect(request).toMatchObject({
      capability: 'web_search',
      method: 'search',
      args: { query: 'latest news' },
      providerConfig: { providerId: 'tavily', apiKey: 'tvly-relayed' },
    });
  });

  it('rejects http source in invokeAgentTool (handled by aiAgent runtime)', async () => {
    const def: ToolDefinition = {
      name: 'fetch',
      description: 'Fetch',
      parameters: {},
      source: { type: 'http', method: 'GET', url: 'https://example.com' },
    };
    await expect(invokeAgentTool(def, {}, { scanRoots: [] })).rejects.toMatchObject({
      code: 'E3012',
    });
  });

  it('rejects mcp source in invokeAgentTool (handled by aiAgent runtime via callMcpTool)', async () => {
    const def: ToolDefinition = {
      name: 'list_dir',
      description: 'List directory',
      parameters: {},
      source: { type: 'mcp', serverId: 'srv-1', toolName: 'list_directory' },
    };
    await expect(invokeAgentTool(def, { path: '.' }, { scanRoots: [] })).rejects.toMatchObject({
      code: 'E3012',
    });
  });
});
