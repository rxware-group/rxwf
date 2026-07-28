import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerPlusExecutors } from './register-plus.js';
import { buildAgentToolDefinitions } from './agent-satellite-tools.js';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import {
  runSubagentTool,
  runToolWorkflow,
  subagentToolDefinition,
  workflowToolDefinition,
} from './run-subagent-tool.js';

vi.mock('./run-ai-agent-node.js', () => ({
  runAiAgentNode: vi.fn(async () => ({
    status: 'success',
    outputItems: [[{ json: { answer: 'subagent-done' } }]],
  })),
}));

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const toolSubagentAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolSubagent.md');
const toolWorkflowAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/toolWorkflow.md');

function subagentHubDefinition(
  overrides: Partial<WorkflowDefinition> = {},
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'subagent-test',
    settings: { maxAgentDepth: 2 },
    nodes: [
      {
        id: 'sub1',
        type: 'toolSubagent',
        name: 'Research',
        position: { x: 0, y: 0 },
        parameters: {
          toolDescription: 'Run research subagent',
          systemPrompt: 'You are a researcher.',
          taskPromptTemplate: 'Task: {{ $fromAI.task }}',
        },
      },
    ],
    connections: [],
    ...overrides,
  };
}

describe('toolWorkflow satellite registry', () => {
  it('throws E2003 when toolWorkflow executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolWorkflow')).toBe(false);
    await expect(
      registry.execute('toolWorkflow', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolWorkflow M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolWorkflowAuditRowPath)).toBe(true);
    const content = readFileSync(toolWorkflowAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolWorkflow');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolWorkflow');
  });
});

describe('workflowToolDefinition', () => {
  it('builds workflow source with workflowId', () => {
    const def = workflowToolDefinition(
      { id: 'tw1', name: 'RunChild', parameters: {} },
      { workflowId: 'child-wf', toolDescription: 'Run child flow' },
    );
    expect(def).toMatchObject({
      name: 'RunChild',
      description: 'Run child flow',
      source: { type: 'workflow', workflowId: 'child-wf' },
    });
  });

  it('uses child schema when inputMapping is empty', () => {
    const def = workflowToolDefinition(
      { id: 'tw1', name: 'RunChild', parameters: { inputMapping: {} } },
      { workflowId: 'child-wf', toolDescription: 'Run child', inputMapping: {} },
      {
        mode: 'fields',
        fields: [{ name: 'query', type: 'string', required: true, description: 'Search' }],
        jsonSchema: {
          type: 'object',
          required: ['query'],
          properties: { query: { type: 'string', description: 'Search' } },
        },
      },
    );
    expect(def.parameters).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', description: 'Search' } },
    });
  });

  it('is registered via buildAgentToolDefinitions with workflow source', () => {
    const tools = buildAgentToolDefinitions([
      {
        id: 'tw1',
        type: 'toolWorkflow',
        name: 'RunChild',
        position: { x: 0, y: 0 },
        parameters: {
          workflowId: 'child-wf',
          toolDescription: 'Run child',
          inputMapping: {},
        },
      },
    ]);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({ type: 'workflow', workflowId: 'child-wf' });
  });
});

describe('runToolWorkflow', () => {
  const baseCtx: NodeExecutionContext = {
    config: {},
    inputItems: [{ json: {} }],
    executionId: 'exec-1',
    subworkflowDepth: 0,
  };

  it('throws E3012 when runSubworkflow is not configured', async () => {
    await expect(
      runToolWorkflow({}, baseCtx, 'child-wf', {}, { query: 'hi' }),
    ).rejects.toMatchObject({ code: 'E3012' });
  });

  it('runs child workflow with requireExposeAsTool and returns outputItems', async () => {
    const runSubworkflow = vi.fn(async () => ({
      executionId: 'child-exec',
      outputItems: [{ json: { ok: true } }],
    }));
    const loadPublishedWorkflowDefinition = vi.fn(
      async (): Promise<WorkflowDefinition | null> => ({
        schemaVersion: 1,
        name: 'child',
        nodes: [
          {
            id: 'st1',
            type: 'subworkflowTrigger',
            name: 'Sub',
            position: { x: 0, y: 0 },
            parameters: { inputMode: 'acceptAll', inputs: [], jsonExample: {} },
          },
        ],
        connections: [],
      }),
    );
    const deps: PlusExecutorDeps = {
      runSubworkflow,
      loadPublishedWorkflowDefinition,
    };
    const output = await runToolWorkflow(
      deps,
      baseCtx,
      'child-wf',
      { inputMapping: {} },
      { any: 'payload' },
    );
    expect(output).toEqual([{ json: { ok: true } }]);
    expect(runSubworkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'child-wf',
        parentExecutionId: 'exec-1',
        depth: 1,
        requireExposeAsTool: true,
      }),
    );
  });
});

describe('toolSubagent satellite registry', () => {
  it('throws E2003 when toolSubagent executor is not registered', async () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('toolSubagent')).toBe(false);
    await expect(
      registry.execute('toolSubagent', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('toolSubagent M-3 audit row', () => {
  it('documents panel, validation, executor satellite, and error_codes with ok status', () => {
    expect(existsSync(toolSubagentAuditRowPath)).toBe(true);
    const content = readFileSync(toolSubagentAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-toolSubagent');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | satellite |');
    expect(content).toContain('E2E-N-toolSubagent');
  });
});

describe('subagentToolDefinition', () => {
  it('builds subagent source with hub node id', () => {
    const def = subagentToolDefinition(
      { id: 'sub1', name: 'Research', parameters: {} },
      { toolDescription: 'Deep research' },
    );
    expect(def).toMatchObject({
      name: 'Research',
      description: 'Deep research',
      source: { type: 'subagent', hubNodeId: 'sub1' },
    });
  });

  it('is registered via buildAgentToolDefinitions', () => {
    const tools = buildAgentToolDefinitions([
      {
        id: 'sub1',
        type: 'toolSubagent',
        name: 'Research',
        position: { x: 0, y: 0 },
        parameters: {
          toolDescription: 'Run subagent',
          systemPrompt: 'You are helpful.',
        },
      },
    ]);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.source).toEqual({ type: 'subagent', hubNodeId: 'sub1' });
  });
});

describe('runSubagentTool', () => {
  it('throws E3001 when AI runtime is not configured', async () => {
    const definition = subagentHubDefinition();
    await expect(
      runSubagentTool(
        {
          config: {},
          inputItems: [],
          workflowDefinition: definition,
        },
        {},
        'sub1',
        { task: 'analyze' },
        0,
      ),
    ).rejects.toMatchObject({ code: 'E3001' });
  });

  it('throws E2003 when hub node is missing', async () => {
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition();
    await expect(
      runSubagentTool(
        {
          config: {},
          inputItems: [],
          workflowDefinition: definition,
        },
        { ai },
        'missing-hub',
        { task: 'analyze' },
        0,
      ),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('throws E1048 when maxAgentDepth would be exceeded', async () => {
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition({ settings: { maxAgentDepth: 1 } });
    await expect(
      runSubagentTool(
        {
          config: {},
          inputItems: [],
          workflowDefinition: definition,
        },
        { ai },
        'sub1',
        { task: 'analyze' },
        1,
      ),
    ).rejects.toMatchObject({ code: 'E1048' });
  });

  it('throws E1050 when readonly subagent has toolWorkflow child', async () => {
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition({
      nodes: [
        {
          id: 'sub1',
          type: 'toolSubagent',
          name: 'Research',
          position: { x: 0, y: 0 },
          parameters: {
            toolDescription: 'Run research subagent',
            systemPrompt: 'You are a researcher.',
            readonly: true,
          },
        },
        {
          id: 'tw1',
          type: 'toolWorkflow',
          name: 'ChildFlow',
          position: { x: 0, y: 80 },
          parameters: { workflowId: 'wf-1', toolDescription: 'Run flow' },
        },
      ],
      connections: [
        { from: 'tw1', to: 'sub1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    });
    await expect(
      runSubagentTool(
        {
          config: {},
          inputItems: [],
          workflowDefinition: definition,
        },
        { ai },
        'sub1',
        { task: 'analyze' },
        0,
      ),
    ).rejects.toMatchObject({ code: 'E1050' });
  });

  it('runs nested ReAct via synthetic aiAgent and returns answer', async () => {
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition();
    const answer = await runSubagentTool(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
      },
      { ai },
      'sub1',
      { task: 'summarize docs' },
      0,
    );
    expect(answer).toBe('subagent-done');
  });

  it('forwards inner agent stream to toolSubagent hub', async () => {
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    vi.mocked(runAiAgentNode).mockImplementationOnce(async (subCtx) => {
      subCtx.onAgentStream?.({ type: 'tool_start', tool: 'ReadFile', input: { path: 'a.txt' } });
      subCtx.onAgentStream?.({ type: 'tool_end', tool: 'ReadFile', output: 'ok' });
      return {
        status: 'success',
        outputItems: [[{ json: { answer: 'subagent-done' } }]],
      };
    });
    const onSatelliteStream = vi.fn();
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition();
    await runSubagentTool(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
        onSatelliteStream,
      },
      { ai },
      'sub1',
      { task: 'read file' },
      0,
    );
    expect(onSatelliteStream).toHaveBeenCalledWith('sub1', {
      type: 'agent_step',
      step: { kind: 'subagentRunStart', userMessage: expect.stringContaining('read file') },
    });
    expect(onSatelliteStream).toHaveBeenCalledWith('sub1', {
      type: 'tool_start',
      tool: 'ReadFile',
      input: { path: 'a.txt' },
    });
    expect(onSatelliteStream).toHaveBeenCalledWith('sub1', {
      type: 'agent_step',
      step: { kind: 'subagentRunEnd', answer: 'subagent-done' },
    });
  });

  it('substitutes taskPromptTemplate with llmArgs', async () => {
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition();
    await runSubagentTool(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
      },
      { ai },
      'sub1',
      { task: 'find bugs' },
      0,
    );
    const call = vi.mocked(runAiAgentNode).mock.calls.at(-1);
    const syntheticDef = call?.[0]?.workflowDefinition;
    const syntheticAgent = syntheticDef?.nodes.find((n) => n.id === 'sub1__subagent');
    expect(String(syntheticAgent?.parameters.text)).toContain('find bugs');
  });

  it('truncates overly long subagent results', async () => {
    const { runAiAgentNode } = await import('./run-ai-agent-node.js');
    vi.mocked(runAiAgentNode).mockResolvedValueOnce({
      status: 'success',
      outputItems: [[{ json: { answer: 'x'.repeat(20_000) } }]],
    });
    const ai = { chat: vi.fn(), runAgent: vi.fn() } as unknown as AiRuntime;
    const definition = subagentHubDefinition({
      nodes: [
        {
          id: 'sub1',
          type: 'toolSubagent',
          name: 'Research',
          position: { x: 0, y: 0 },
          parameters: {
            toolDescription: 'Run research subagent',
            systemPrompt: 'You are a researcher.',
            maxSubagentResultTokens: 100,
          },
        },
      ],
    });
    const answer = await runSubagentTool(
      {
        config: {},
        inputItems: [],
        workflowDefinition: definition,
      },
      { ai },
      'sub1',
      {},
      0,
    );
    expect(answer.length).toBeLessThan(20_000);
    expect(answer).toContain('[truncated]');
  });
});
