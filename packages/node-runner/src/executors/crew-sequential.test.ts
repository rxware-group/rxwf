import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createCrewSequentialExecutor } from './crew-sequential.js';

function crewDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'crew-test',
    settings: { workflowKind: 'agent' },
    nodes: [
      { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
      {
        id: 'crew',
        type: 'crewSequential',
        name: 'Crew',
        position: { x: 200, y: 0 },
        parameters: {},
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 100 },
        parameters: { role: 'Researcher', goal: 'Summarize input' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Writer',
        position: { x: 200, y: 100 },
        parameters: { role: 'Writer', goal: 'Polish prior answer' },
      },
      {
        id: 'mdl1',
        type: 'aiChatModel',
        name: 'Model1',
        position: { x: 0, y: 200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'mdl2',
        type: 'aiChatModel',
        name: 'Model2',
        position: { x: 200, y: 200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't1',
        type: 'toolHttp',
        name: 'Http1',
        position: { x: 0, y: 280 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'fetch',
        },
      },
      {
        id: 't2',
        type: 'toolHttp',
        name: 'Http2',
        position: { x: 200, y: 280 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'fetch',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'crew' },
      { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'a2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'mdl2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't1', to: 'a1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      { from: 't2', to: 'a2', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

describe('createCrewSequentialExecutor', () => {
  it('runs members in order and passes prior answer', async () => {
    const answers = ['step-one', 'step-two'];
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: answers.shift() ?? 'done' } }],
    }));
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const executor = createCrewSequentialExecutor({ ai });
    const result = await executor.execute({
      config: {},
      inputItems: [{ json: { task: 'hello' } }],
      workflowDefinition: crewDefinition(),
      nodeId: 'crew',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-1',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('step-two');
    const crewSteps = result.outputItems?.[0]?.[0]?.json.crewSteps as Array<{
      name: string;
      answer: string;
    }>;
    expect(crewSteps).toHaveLength(2);
    expect(crewSteps[0]?.name).toBe('Researcher');
    expect(crewSteps[1]?.answer).toBe('step-two');
  });

  it('fails with E1030 when fewer than two crew members', async () => {
    const def = crewDefinition();
    def.connections = def.connections.filter((c) => c.from !== 'a2');
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewSequentialExecutor({ ai });

    const result = await executor.execute({
      config: {},
      inputItems: [{ json: { task: 'hello' } }],
      workflowDefinition: def,
      nodeId: 'crew',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      parentExecutionId: 'exec-1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1030');
  });

  it('throws E2003 when workflow definition context is missing', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewSequentialExecutor({ ai });

    await expect(
      executor.execute({
        config: {},
        inputItems: [{ json: {} }],
        nodeId: 'crew',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        parentExecutionId: 'exec-1',
      }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });
});

describe('crewSequential registry', () => {
  it('throws E2003 when crewSequential executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('crewSequential', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered when createCrewSequentialExecutor is wired', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const registry = createExecutorRegistry();
    registry.register(createCrewSequentialExecutor({ ai }));
    expect(registry.has('crewSequential')).toBe(true);
  });
});
