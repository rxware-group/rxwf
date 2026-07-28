import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createLlmStreamExecutor, type LlmStreamExecutorDeps } from './llm-stream.js';

describe('llmStream registry', () => {
  it('throws E2003 when llmStream executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('llmStream', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable when createLlmStreamExecutor is wired', async () => {
    const chat = vi.fn(async function* () {
      yield 'stream-chunk';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const registry = createExecutorRegistry();
    registry.register(createLlmStreamExecutor({ ai }));
    expect(registry.has('llmStream')).toBe(true);

    const result = await registry.execute('llmStream', {
      config: { prompt: 'ping' },
      inputItems: [{ json: {} }],
      nodeId: 'n1',
      executionId: 'e1',
      workflowId: 'w1',
      parentExecutionId: 'e1',
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.stream).toBe('stream-chunk');
  });
});

describe('createLlmStreamExecutor', () => {
  it('passes resolved model ref to ai.chat and returns stream field', async () => {
    const chat = vi.fn(async function* (_messages, opts?: { model?: ModelRef }) {
      expect(opts?.model).toEqual({
        provider: 'ollama',
        model: 'qwen3:8b',
        baseUrl: 'http://127.0.0.1:11434',
      });
      yield 'hello';
      yield ' world';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const resolveOllamaModelRef = vi.fn(async () => ({
      provider: 'ollama' as const,
      model: 'qwen3:8b',
      baseUrl: 'http://127.0.0.1:11434',
    }));
    const deps: LlmStreamExecutorDeps = { ai, resolveOllamaModelRef };
    const executor = createLlmStreamExecutor(deps);

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
    expect(result.outputItems?.[0]?.[0]?.json.stream).toBe('hello world');
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
    const executor = createLlmStreamExecutor({ ai, resolveOllamaModelRef });

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
    const executor = createLlmStreamExecutor({});

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
    const chat = vi.fn(async function* () {
      yield 'stream-ok';
    });
    const ai = { chat, runAgent: vi.fn() } as unknown as AiRuntime;
    const executor = createLlmStreamExecutor({ ai });

    const result = await executor.execute({
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
    expect(result.outputItems?.[0]?.[0]?.json.stream).toBe('stream-ok');
  });
});
