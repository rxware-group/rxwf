import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { createAiAgentExecutor } from './ai-agent.js';
import type { WorkflowDefinition } from '@rxwf/workflow';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-flow',
  nodes: [
    { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 1, y: 0 }, parameters: {} },
    {
      id: 'mdl',
      type: 'aiChatModel',
      name: 'Model',
      position: { x: 0, y: 1 },
      parameters: { provider: 'ollama', model: 'llama3' },
    },
    {
      id: 'tool',
      type: 'toolMcp',
      name: 'McpTool',
      position: { x: 2, y: 1 },
      parameters: {
        serverId: 'srv-1',
        tools: ['list_directory'],
        toolDescription: 'Lists a directory',
      },
    },
  ],
  connections: [
    { from: 'tr', to: 'agt' },
    { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ],
};

describe('createAiAgentExecutor', () => {
  it('runs agent with MCP tool via runAgent', async () => {
    const callMcpTool = vi.fn(async () => ({ ok: true }));
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'done', agentSteps: [] } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const executor = createAiAgentExecutor({ ai, callMcpTool });
    const result = await executor.execute({
      config: {},
      inputItems: [{ json: { q: 'list files' } }],
      workflowDefinition: definition,
      nodeId: 'agt',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-1',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('done');
  });

  it('runs agent without Tool via runAgent chat branch', async () => {
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'chat-only', agentSteps: [] } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const defNoTool: WorkflowDefinition = {
      ...definition,
      nodes: definition.nodes.filter((n) => n.id !== 'tool'),
      connections: definition.connections.filter((c) => c.from !== 'tool'),
    };

    const executor = createAiAgentExecutor({ ai });
    const result = await executor.execute({
      config: {},
      inputItems: [{ json: { q: 'hello' } }],
      workflowDefinition: defNoTool,
      nodeId: 'agt',
      executionId: 'exec-2',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-2',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('chat-only');
  });

  it('runs agent with toolRead satellite via embedded filesystem invoke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-ai-toolread-'));
    const filePath = join(dir, 'hello.txt');
    await writeFile(filePath, 'file-content', 'utf8');

    const defWithRead: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'agent-read',
      nodes: [
        { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 1, y: 0 }, parameters: {} },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 0, y: 1 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'read-tool',
          type: 'toolRead',
          name: 'read_file',
          position: { x: 2, y: 1 },
          parameters: { toolDescription: 'Read a file under workspace' },
        },
      ],
      connections: [
        { from: 'tr', to: 'agt' },
        { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'read-tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    };

    const runAgent = vi.fn(async (input) => {
      expect(input.tools).toHaveLength(1);
      expect(input.tools[0]?.source).toEqual({
        type: 'filesystem',
        operation: 'read',
        toolNodeId: 'read-tool',
      });
      const content = await input.invokeTool!(input.tools[0]!, { path: filePath });
      expect(content).toBe('file-content');
      return {
        items: [{ json: { answer: 'read ok', agentSteps: [] } }],
      };
    });
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const executor = createAiAgentExecutor({ ai });
    const result = await executor.execute({
      config: { workspaceRoot: dir },
      inputItems: [{ json: { q: 'read file' } }],
      workflowDefinition: defWithRead,
      nodeId: 'agt',
      executionId: 'exec-read',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-read',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('read ok');
  });
});
