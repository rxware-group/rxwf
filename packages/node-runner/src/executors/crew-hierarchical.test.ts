import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createCrewHierarchicalExecutor } from './crew-hierarchical.js';
import { parseManagerDecision } from './crew-helpers.js';
import { registerPlusExecutors } from './register-plus.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const crewHierarchicalAuditRowPath = join(
  repoRoot,
  'docs/test/node-audit-rows/crewHierarchical.md',
);

function hierarchicalDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'crew-h',
    settings: { workflowKind: 'agent' },
    nodes: [
      { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
      {
        id: 'crew',
        type: 'crewHierarchical',
        name: 'Crew',
        position: { x: 200, y: 0 },
        parameters: { maxDelegations: 3 },
      },
      {
        id: 'mgr',
        type: 'aiAgent',
        name: 'Manager',
        position: { x: 200, y: -100 },
        parameters: { role: 'Manager', goal: 'Delegate and synthesize' },
      },
      {
        id: 'w1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 100 },
        parameters: { role: 'Researcher', goal: 'Research' },
      },
      {
        id: 'w2',
        type: 'aiAgent',
        name: 'Writer',
        position: { x: 400, y: 100 },
        parameters: { role: 'Writer', goal: 'Write' },
      },
      {
        id: 'mdl-m',
        type: 'aiChatModel',
        name: 'Model M',
        position: { x: 200, y: -200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'mdl-w1',
        type: 'aiChatModel',
        name: 'Model W1',
        position: { x: 0, y: 200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'mdl-w2',
        type: 'aiChatModel',
        name: 'Model W2',
        position: { x: 400, y: 200 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't-m',
        type: 'toolHttp',
        name: 'Tool M',
        position: { x: 280, y: -200 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'mgr tool',
        },
      },
      {
        id: 't-w1',
        type: 'toolHttp',
        name: 'Tool W1',
        position: { x: 80, y: 200 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'w1 tool',
        },
      },
      {
        id: 't-w2',
        type: 'toolHttp',
        name: 'Tool W2',
        position: { x: 480, y: 200 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'w2 tool',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'crew' },
      { from: 'mgr', to: 'crew', fromOutput: 'crew_manager', toInput: 'crew_manager' },
      { from: 'w1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'w2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl-m', to: 'mgr', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'mdl-w1', to: 'w1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'mdl-w2', to: 'w2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't-m', to: 'mgr', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      { from: 't-w1', to: 'w1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      { from: 't-w2', to: 'w2', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

describe('crewHierarchical registry', () => {
  it('throws E2003 when crewHierarchical executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('crewHierarchical', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('crewHierarchical')).toBe(true);
  });
});

describe('crewHierarchical M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(crewHierarchicalAuditRowPath)).toBe(true);
    const content = readFileSync(crewHierarchicalAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-crewHierarchical');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-crewHierarchical');
  });
});

describe('parseManagerDecision', () => {
  it('parses delegate and finish JSON', () => {
    expect(
      parseManagerDecision('{"action":"delegate","member":"Researcher","task":"dig"}'),
    ).toEqual({ action: 'delegate', member: 'Researcher', task: 'dig' });
    expect(parseManagerDecision('{"action":"finish","answer":"done"}')).toEqual({
      action: 'finish',
      answer: 'done',
    });
  });

  it('parses delegate_parallel JSON', () => {
    expect(
      parseManagerDecision(
        '{"action":"delegate_parallel","assignments":[{"member":"A","task":"t1"},{"member":"B","task":"t2"}]}',
      ),
    ).toEqual({
      action: 'delegate_parallel',
      assignments: [
        { member: 'A', task: 't1' },
        { member: 'B', task: 't2' },
      ],
    });
  });
});

describe('createCrewHierarchicalExecutor', () => {
  it('delegates then finishes via manager chat', async () => {
    const chatResponses = [
      '{"action":"delegate","member":"Researcher","task":"summarize input"}',
      '{"action":"finish","answer":"final synthesis"}',
    ];
    const chat = vi.fn(async function* () {
      yield chatResponses.shift() ?? '{"action":"finish","answer":"ok"}';
    });
    const runAgent = vi.fn(async () => ({
      items: [{ json: { answer: 'worker result' } }],
    }));
    const ai = { chat, runAgent } as unknown as AiRuntime;

    const executor = createCrewHierarchicalExecutor({ ai });
    const result = await executor.execute({
      config: { maxDelegations: 3 },
      inputItems: [{ json: { topic: 'AI' } }],
      workflowDefinition: hierarchicalDefinition(),
      nodeId: 'crew',
      executionId: 'exec-1',
      workflowId: 'wf-1',
    });

    expect(result.status).toBe('success');
    expect(chat).toHaveBeenCalled();
    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('final synthesis');
    const steps = result.outputItems?.[0]?.[0]?.json.crewSteps as Array<{ name: string }>;
    expect(steps).toHaveLength(1);
    expect(steps[0]?.name).toBe('Researcher');
  });

  it('runs multiple workers concurrently on delegate_parallel', async () => {
    const chatResponses = [
      '{"action":"delegate_parallel","assignments":[{"member":"Researcher","task":"A"},{"member":"Writer","task":"B"}]}',
      '{"action":"finish","answer":"merged"}',
    ];
    const chat = vi.fn(async function* () {
      yield chatResponses.shift() ?? '{"action":"finish","answer":"ok"}';
    });

    let running = 0;
    let maxRunning = 0;
    const runAgent = vi.fn(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 40));
      running -= 1;
      return { items: [{ json: { answer: 'part' } }] };
    });
    const ai = { chat, runAgent } as unknown as AiRuntime;

    const executor = createCrewHierarchicalExecutor({ ai });
    const result = await executor.execute({
      config: { maxDelegations: 2 },
      inputItems: [{ json: { topic: 'parallel' } }],
      workflowDefinition: hierarchicalDefinition(),
      nodeId: 'crew',
      executionId: 'exec-2',
      workflowId: 'wf-2',
    });

    expect(result.status).toBe('success');
    expect(maxRunning).toBeGreaterThanOrEqual(2);
    expect(runAgent).toHaveBeenCalledTimes(2);
    const steps = result.outputItems?.[0]?.[0]?.json.crewSteps as Array<{ name: string }>;
    expect(steps).toHaveLength(2);
  });

  it('returns E1031 when crew_manager is not connected', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewHierarchicalExecutor({ ai });
    const definition = hierarchicalDefinition();
    definition.connections = definition.connections.filter(
      (c) => !(c.fromOutput === 'crew_manager' && c.toInput === 'crew_manager'),
    );

    const result = await executor.execute({
      config: { maxDelegations: 3 },
      inputItems: [{ json: { topic: 'AI' } }],
      workflowDefinition: definition,
      nodeId: 'crew',
      executionId: 'exec-3',
      workflowId: 'wf-3',
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1031');
  });

  it('returns E1032 when no crew_member workers are connected', async () => {
    const ai = { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createCrewHierarchicalExecutor({ ai });
    const definition = hierarchicalDefinition();
    definition.connections = definition.connections.filter(
      (c) => !(c.fromOutput === 'crew_member' && c.toInput === 'crew_member'),
    );

    const result = await executor.execute({
      config: { maxDelegations: 3 },
      inputItems: [{ json: { topic: 'AI' } }],
      workflowDefinition: definition,
      nodeId: 'crew',
      executionId: 'exec-4',
      workflowId: 'wf-4',
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1032');
  });
});
