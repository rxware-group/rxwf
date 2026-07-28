import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createLlmExecutor, type LlmExecutorDeps } from './llm.js';

describe('llm registry', () => {
  it('throws E2003 when llm executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('llm', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable when createLlmExecutor is wired', async () => {
    const chat = vi.fn(async function* () {
      yield 'registry-ok';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const registry = createExecutorRegistry();
    registry.register(createLlmExecutor({ ai }));
    expect(registry.has('llm')).toBe(true);

    const result = await registry.execute('llm', {
      config: { prompt: 'ping' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.response).toBe('registry-ok');
  });
});

describe('createLlmExecutor', () => {
  it('passes resolved model ref to ai.chat', async () => {
    const chat = vi.fn(async function* (_messages, opts?: { model?: ModelRef }) {
      expect(opts?.model).toEqual({
        provider: 'ollama',
        model: 'qwen3:8b',
        baseUrl: 'http://127.0.0.1:11434',
      });
      yield 'hello';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const resolveOllamaModelRef = vi.fn(async () => ({
      provider: 'ollama' as const,
      model: 'qwen3:8b',
      baseUrl: 'http://127.0.0.1:11434',
    }));
    const deps: LlmExecutorDeps = { ai, resolveOllamaModelRef };
    const executor = createLlmExecutor(deps);

    const result = await executor.execute({
      config: { prompt: 'Say hi' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(resolveOllamaModelRef).toHaveBeenCalledWith({ prompt: 'Say hi' });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.response).toBe('hello');
  });

  it('uses node config.model when resolver returns it', async () => {
    const chat = vi.fn(async function* () {
      yield 'ok';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const resolveOllamaModelRef = vi.fn(async (nodeConfig: Record<string, unknown>) => ({
      provider: 'ollama' as const,
      model: String(nodeConfig.model ?? 'llama3'),
      baseUrl: 'http://127.0.0.1:11434',
    }));
    const executor = createLlmExecutor({ ai, resolveOllamaModelRef });

    await executor.execute({
      config: { prompt: 'x', model: 'custom-model' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'x' }],
      {
        model: {
          provider: 'ollama',
          model: 'custom-model',
          baseUrl: 'http://127.0.0.1:11434',
        },
      },
    );
  });

  it('fails with E3001 message when AI runtime is not configured', async () => {
    const executor = createLlmExecutor({});

    const result = await executor.execute({
      config: { prompt: 'x' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/E3001|AI runtime not configured/i);
  });

  it('resolves {{ $json.stdout }} in prompt from input item', async () => {
    const chat = vi.fn(async function* (_messages, opts?: { messages?: unknown }) {
      void opts;
      yield 'ok';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createLlmExecutor({ ai });

    await executor.execute({
      config: { prompt: '{{ $json.stdout }}' },
      inputItems: [{ json: { stdout: 'Who are you?' } }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });

    expect(chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Who are you?' }],
      expect.any(Object),
    );
  });
});
