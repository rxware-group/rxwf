import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { createAiAgentExecutor } from './ai-agent.js';
import type { WorkflowDefinition } from '@rxwf/workflow';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-from-ai',
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
      type: 'toolHttp',
      name: 'SearchApi',
      position: { x: 2, y: 1 },
      parameters: {
        method: 'GET',
        url: 'https://example.com/search?q={{ $fromAI("query", "Search query", "string") }}',
        toolDescription: 'Search the web',
      },
    },
  ],
  connections: [
    { from: 'tr', to: 'agt' },
    { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ],
};

describe('createAiAgentExecutor fromAI', () => {
  it('passes JSON schema built from $fromAI in tool params to runAgent', async () => {
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'done', agentSteps: [] } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const executor = createAiAgentExecutor({ ai });
    const result = await executor.execute({
      config: {},
      inputItems: [{ json: { q: 'hello' } }],
      workflowDefinition: definition,
      nodeId: 'agt',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-1',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
    const calls = (runAgent as { mock: { calls: unknown[][] } }).mock.calls;
    const input = calls[0]![0] as import('@rxwf/ai-runtime-stub').AgentRunInput;
    expect(input.tools[0]?.parameters).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
    });
  });
});
