import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { jsonExecutor } from './json.js';

describe('jsonExecutor registry', () => {
  it('registers json executor via registerBuiltinExecutors', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('json')).toBe(true);
  });
});

describe('jsonExecutor', () => {
  it('outputs parsed json from config.data legacy field', async () => {
    const result = await jsonExecutor.execute({
      config: { data: { message: 'hi' } },
      inputItems: [{ json: {} }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ message: 'hi' });
  });

  it('resolves JSON with embedded {{ }} templates', async () => {
    const result = await jsonExecutor.execute({
      config: {
        expression: '{ "url": "{{ $env.API_URL }}", "id": "{{ $json.id }}" }',
      },
      env: { API_URL: 'https://api.example.com' },
      inputItems: [{ json: { id: 9 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      url: 'https://api.example.com',
      id: '9',
    });
  });

  it('evaluates full ={{ $json }} expression', async () => {
    const result = await jsonExecutor.execute({
      config: {
        expression: '={{ $json }}',
      },
      inputItems: [{ json: { ok: true, n: 1 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ ok: true, n: 1 });
  });

  it('returns empty object when expression is blank', async () => {
    const result = await jsonExecutor.execute({
      config: { expression: '   ' },
      inputItems: [{ json: { kept: true } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({});
  });

  it('throws E1002 for invalid fixed JSON without templates', async () => {
    await expect(
      jsonExecutor.execute({
        config: { expression: '{ not-json' },
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E1002', message: 'Invalid JSON expression' });
  });

  it('wraps non-object JSON literals under value key', async () => {
    const result = await jsonExecutor.execute({
      config: { expression: '[1, 2, 3]' },
      inputItems: [{ json: {} }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ value: [1, 2, 3] });
  });

  it('preserves binary fields on output items', async () => {
    const result = await jsonExecutor.execute({
      config: { expression: '{ "tag": "ok" }' },
      inputItems: [
        {
          json: { id: 1 },
          binary: { file: { data: 'YmFzZTY0', mimeType: 'text/plain' } },
        },
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ tag: 'ok' });
    expect(result.outputItems?.[0]?.[0]?.binary).toEqual({
      file: { data: 'YmFzZTY0', mimeType: 'text/plain' },
    });
  });
});
