import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createAiAgentExecutor } from './ai-agent.js';
import { runAiAgentNode } from './run-ai-agent-node.js';

const definitionWithModel: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-with-model',
  nodes: [
    { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 0, y: 0 }, parameters: { prompt: 'hi' } },
    {
      id: 'mdl',
      type: 'aiChatModel',
      name: 'Model',
      position: { x: 0, y: 1 },
      parameters: { provider: 'ollama', model: 'llama3' },
    },
  ],
  connections: [
    { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
  ],
};

describe('aiAgent registry', () => {
  it('throws E2003 when aiAgent executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('aiAgent', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable when createAiAgentExecutor is wired', async () => {
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'ok', agentSteps: [] } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;
    const registry = createExecutorRegistry();
    registry.register(createAiAgentExecutor({ ai }));
    expect(registry.has('aiAgent')).toBe(true);

    const result = await registry.execute('aiAgent', {
      config: { prompt: 'ping' },
      inputItems: [{ json: {} }],
      workflowDefinition: definitionWithModel,
      nodeId: 'agt',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('ok');
  });
});

describe('runAiAgentNode error paths', () => {
  it('fails with E3010 when no connected Chat Model', async () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'no-model',
      nodes: [
        { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [],
    };
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;

    const result = await runAiAgentNode(
      {
        config: {},
        inputItems: [{ json: {} }],
        workflowDefinition: definition,
        nodeId: 'agt',
        executionId: 'e1',
        workflowId: 'w1',
      },
      { ai },
      { agentNodeId: 'agt', agentParams: {} },
    );

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E3010');
    expect(result.errorMessage).toMatch(/Chat Model/i);
  });
});

describe('createAiAgentExecutor context errors', () => {
  it('throws E3001 when AI runtime is not configured', async () => {
    const executor = createAiAgentExecutor({});
    await expect(
      executor.execute({
        config: {},
        inputItems: [],
        workflowDefinition: definitionWithModel,
        nodeId: 'agt',
        executionId: 'e1',
        workflowId: 'w1',
      }),
    ).rejects.toMatchObject({ code: 'E3001' });
  });

  it('throws E2003 when workflow definition is missing', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createAiAgentExecutor({ ai });
    await expect(
      executor.execute({
        config: {},
        inputItems: [],
        nodeId: 'agt',
        executionId: 'e1',
        workflowId: 'w1',
      }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});
