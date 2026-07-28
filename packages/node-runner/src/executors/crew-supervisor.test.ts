import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createCrewSupervisorExecutor } from './crew-supervisor.js';
import { parseSupervisorDecision } from './crew-helpers.js';

function supervisorDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'supervisor',
    settings: { workflowKind: 'agent' },
    nodes: [
      { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
      {
        id: 'sup',
        type: 'crewSupervisor',
        name: 'Supervisor',
        position: { x: 200, y: 0 },
        parameters: {
          maxSteps: 5,
          supervisorProvider: 'ollama',
          supervisorModel: 'llama3',
        },
      },
      {
        id: 'w1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 100 },
        parameters: { role: 'Researcher', goal: 'Research' },
      },
      {
        id: 'mdl-w',
        type: 'aiChatModel',
        name: 'Model W',
        position: { x: 0, y: 200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't-w',
        type: 'toolHttp',
        name: 'Tool W',
        position: { x: 80, y: 280 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'tool',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'sup' },
      { from: 'w1', to: 'sup', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl-w', to: 'w1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't-w', to: 'w1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

describe('crewSupervisor registry', () => {
  it('throws E2003 when crewSupervisor executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('crewSupervisor', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable when createCrewSupervisorExecutor is wired', async () => {
    const chatResponses = ['{"action":"finish","answer":"registry-ok"}'];
    const chat = vi.fn(async function* () {
      yield chatResponses.shift() ?? '{"action":"finish","answer":"ok"}';
    });
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'worker out' } }],
    }));
    const ai = { chat, runAgent } as unknown as AiRuntime;
    const registry = createExecutorRegistry();
    registry.register(createCrewSupervisorExecutor({ ai }));
    expect(registry.has('crewSupervisor')).toBe(true);

    const result = await registry.execute('crewSupervisor', {
      config: {
        maxSteps: 3,
        supervisorProvider: 'ollama',
        supervisorModel: 'llama3',
      },
      inputItems: [{ json: { task: 'ping' } }],
      workflowDefinition: supervisorDefinition(),
      nodeId: 'sup',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('registry-ok');
    expect(result.outputItems?.[0]?.[0]?.json.process).toBe('supervisor');
  });
});

describe('parseSupervisorDecision', () => {
  it('maps run and run_parallel', () => {
    expect(
      parseSupervisorDecision('{"action":"run","member":"Researcher","task":"go"}'),
    ).toEqual({ action: 'run', member: 'Researcher', task: 'go' });
    expect(
      parseSupervisorDecision(
        '{"action":"run_parallel","assignments":[{"member":"A","task":"t"}]}',
      ),
    ).toEqual({
      action: 'run_parallel',
      assignments: [{ member: 'A', task: 't' }],
    });
  });
});

describe('createCrewSupervisorExecutor', () => {
  it('fails with E1032 when no crew_member workers are connected', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewSupervisorExecutor({ ai });
    const definition = supervisorDefinition();
    definition.connections = definition.connections.filter((c) => c.fromOutput !== 'crew_member');

    const result = await executor.execute({
      config: {
        maxSteps: 5,
        supervisorProvider: 'ollama',
        supervisorModel: 'llama3',
      },
      inputItems: [{ json: { q: 'test' } }],
      workflowDefinition: definition,
      nodeId: 'sup',
      executionId: 'exec-1',
      workflowId: 'wf-1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1032');
  });

  it('fails with E1035 when supervisor model is missing', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewSupervisorExecutor({ ai });

    const result = await executor.execute({
      config: {
        maxSteps: 5,
        supervisorProvider: 'ollama',
        supervisorModel: '',
      },
      inputItems: [{ json: { q: 'test' } }],
      workflowDefinition: supervisorDefinition(),
      nodeId: 'sup',
      executionId: 'exec-1',
      workflowId: 'wf-1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1035');
  });

  it('runs dynamic supervisor loop', async () => {
    const chatResponses = [
      '{"action":"run","member":"Researcher","task":"analyze"}',
      '{"action":"run","member":"Researcher","task":"refine"}',
      '{"action":"finish","answer":"final"}',
    ];
    const chat = vi.fn(async function* () {
      yield chatResponses.shift() ?? '{"action":"finish","answer":"ok"}';
    });
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'worker out' } }],
    }));
    const ai = { chat, runAgent } as unknown as AiRuntime;

    const executor = createCrewSupervisorExecutor({ ai });
    const result = await executor.execute({
      config: {
        maxSteps: 5,
        supervisorProvider: 'ollama',
        supervisorModel: 'llama3',
      },
      inputItems: [{ json: { q: 'test' } }],
      workflowDefinition: supervisorDefinition(),
      nodeId: 'sup',
      executionId: 'exec-1',
      workflowId: 'wf-1',
    });

    expect(result.status).toBe('success');
    expect(chat).toHaveBeenCalledTimes(3);
    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('final');
    const steps = result.outputItems?.[0]?.[0]?.json.crewSteps as unknown[];
    expect(steps).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json.process).toBe('supervisor');
  });
});
