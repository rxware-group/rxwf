import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { runAiAgentNode } from './run-ai-agent-node.js';

const definition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-prompt',
  nodes: [
    {
      id: 'agt',
      type: 'aiAgent',
      name: 'Agent',
      position: { x: 0, y: 0 },
      parameters: { prompt: '{{ $json.prompt }}' },
    },
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

describe('runAiAgentNode prompt templates', () => {
  it('resolves {{ $json.prompt }} from upstream items', async () => {
    const runAgent = vi.fn(async (input: { userMessage: string }) => {
      expect(input.userMessage).toBe('hello-from-upstream');
      return { items: [{ json: { answer: 'ok' } }] };
    });
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const agentParams = {
      prompt: '{{ $json.prompt }}',
      systemPrompt: '你是C++开发工程师',
    };
    const result = await runAiAgentNode(
      {
        config: agentParams,
        inputItems: [{ json: { prompt: 'hello-from-upstream' } }],
        workflowDefinition: definition,
        nodeId: 'agt',
        executionId: 'exec-1',
        workflowId: 'wf-1',
      },
      { ai },
      {
        agentNodeId: 'agt',
        agentParams,
      },
    );

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
  });

  it('runs agent once per input item with per-item prompt templates', async () => {
    const runAgent = vi.fn(async (input: { userMessage: string }) => {
      return { items: [{ json: { answer: `ok:${input.userMessage}` } }] };
    });
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    const agentParams = { prompt: '{{ $json.prompt }}' };
    const result = await runAiAgentNode(
      {
        config: agentParams,
        inputItems: [
          { json: { prompt: 'first' } },
          { json: { prompt: 'second' } },
        ],
        workflowDefinition: definition,
        nodeId: 'agt',
        executionId: 'exec-1',
        workflowId: 'wf-1',
      },
      { ai },
      { agentNodeId: 'agt', agentParams },
    );

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent.mock.calls[0]![0].userMessage).toBe('first');
    expect(runAgent.mock.calls[1]![0].userMessage).toBe('second');
    expect(result.outputItems?.[0]).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json.answer).toBe('ok:first');
    expect(result.outputItems?.[0]?.[1]?.json.answer).toBe('ok:second');
  });

  it('passes outputSchema without duplicating JSON hint in systemPrompt', async () => {
    const outputSchema = {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
    };
    const defWithParser: WorkflowDefinition = {
      ...definition,
      nodes: [
        ...definition.nodes,
        {
          id: 'parser',
          type: 'aiOutputParser',
          name: 'Parser',
          position: { x: 0, y: 2 },
          parameters: { jsonSchema: outputSchema },
        },
      ],
      connections: [
        ...definition.connections,
        {
          from: 'parser',
          to: 'agt',
          fromOutput: 'ai_outputParser',
          toInput: 'ai_outputParser',
        },
      ],
    };
    const runAgent = vi.fn(async (input: { systemPrompt?: string; outputSchema?: unknown }) => {
      expect(input.outputSchema).toEqual(outputSchema);
      expect(input.systemPrompt).toBe('你是C++开发工程师');
      expect(input.systemPrompt?.match(/You must respond with valid JSON/g)?.length ?? 0).toBe(0);
      return { items: [{ json: { answer: '{"answer":"ok"}' } }] };
    });
    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;

    await runAiAgentNode(
      {
        config: { prompt: 'hi', systemPrompt: '你是C++开发工程师' },
        inputItems: [{ json: {} }],
        workflowDefinition: defWithParser,
        nodeId: 'agt',
        executionId: 'exec-1',
        workflowId: 'wf-1',
      },
      { ai },
      {
        agentNodeId: 'agt',
        agentParams: { prompt: 'hi', systemPrompt: '你是C++开发工程师' },
      },
    );

    expect(runAgent).toHaveBeenCalled();
  });

  it('resolves crew role templates before building role prompt context', async () => {
    const { resolveAgentParameters } = await import('../expression/resolve-agent-params.js');
    const resolved = await resolveAgentParameters(
      { role: '{{ $json.roleName }}', goal: 'static goal' },
      {
        inputItems: [{ json: { roleName: 'Researcher' } }],
      },
    );
    expect(resolved.role).toBe('Researcher');
    expect(resolved.goal).toBe('static goal');
  });
});
