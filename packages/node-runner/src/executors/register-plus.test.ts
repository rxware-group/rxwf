import { describe, expect, it, vi } from 'vitest';
import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerPlusExecutors } from './register-plus.js';

describe('registerPlusExecutors llm', () => {
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

    const registry = createExecutorRegistry();
    registerPlusExecutors(registry, { ai, resolveOllamaModelRef });
    expect(registry.has('llm')).toBe(true);

    const result = await registry.execute('llm', {
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

    const registry = createExecutorRegistry();
    registerPlusExecutors(registry, { ai, resolveOllamaModelRef });

    await registry.execute('llm', {
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
});
