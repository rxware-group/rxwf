import { describe, it, expect, vi } from 'vitest';
import { createOllamaAiRuntime } from './runtime.js';

describe('createOllamaAiRuntime', () => {
  it('streams tokens from Ollama generate API (AC-5)', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: 'hello from ollama' }),
    })) as unknown as typeof fetch;
    const runtime = createOllamaAiRuntime({
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
      fetchFn,
    });
    const chunks: string[] = [];
    for await (const chunk of runtime.chat([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toContain('hello');
    expect(fetchFn).toHaveBeenCalled();
  });
});
