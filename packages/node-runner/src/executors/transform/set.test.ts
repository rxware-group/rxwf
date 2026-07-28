import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { setExecutor } from './set.js';

describe('set registry', () => {
  it('throws E2003 when set executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('set', {
        config: { fields: { ok: true } },
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable via registerBuiltinExecutors', async () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('set')).toBe(true);

    const result = await registry.execute('set', {
      config: { fields: { status: 'ok' } },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ id: 1, status: 'ok' });
  });
});

describe('setExecutor', () => {
  it('merges static fields into each input item', async () => {
    const result = await setExecutor.execute({
      config: { fields: { status: 'done', count: 3 } },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      id: 1,
      status: 'done',
      count: 3,
    });
  });

  it('merges n8n values[] rows into each input item', async () => {
    const result = await setExecutor.execute({
      config: { values: [{ name: 'ok', value: true }] },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ id: 1, ok: true });
  });

  it('keeps template literals in manual mode', async () => {
    const result = await setExecutor.execute({
      config: {
        mode: 'manual',
        fields: { url: '{{ $env.API_URL }}' },
      },
      env: { API_URL: 'https://api.example.com' },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      id: 1,
      url: '{{ $env.API_URL }}',
    });
  });

  it('resolves template field values in expression mode', async () => {
    const result = await setExecutor.execute({
      config: {
        mode: 'expression',
        fields: {
          url: '{{ $env.API_URL }}',
          userId: '{{ $json.id }}',
        },
      },
      env: { API_URL: 'https://api.example.com' },
      inputItems: [{ json: { id: 7 } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      id: 7,
      url: 'https://api.example.com',
      userId: '7',
    });
  });

  it('resolves $vars in expression mode', async () => {
    const result = await setExecutor.execute({
      config: {
        mode: 'expression',
        fields: { base: '{{ $vars.API_BASE }}' },
      },
      vars: { API_BASE: 'https://vars.example.com' },
      inputItems: [{ json: {} }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      base: 'https://vars.example.com',
    });
  });

  it('resolves $nodes references from preceding nodes in expression mode', async () => {
    const result = await setExecutor.execute({
      config: {
        mode: 'expression',
        fields: { upstream: '{{ $nodes["Upstream"].json.tag }}' },
      },
      inputItems: [{ json: { id: 2 } }],
      nodes: [
        {
          name: 'Upstream',
          json: { tag: 'from-a' },
          items: [{ json: { tag: 'from-a' } }],
        },
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      id: 2,
      upstream: 'from-a',
    });
  });

  it('merges binary attachment fields into item.binary in expression mode', async () => {
    const attachment = {
      data: Buffer.from('hello').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 5,
    };
    const result = await setExecutor.execute({
      config: {
        mode: 'expression',
        fields: { copy: '={{ $binary.data }}' },
      },
      inputItems: [
        {
          json: { id: 1 },
          binary: { data: attachment },
        },
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ id: 1 });
    expect(result.outputItems?.[0]?.[0]?.binary?.copy).toEqual(attachment);
    expect(result.outputItems?.[0]?.[0]?.binary?.data).toEqual(attachment);
  });

  it('preserves existing binary when setting json-only fields', async () => {
    const attachment = {
      data: Buffer.from('x').toString('base64'),
      mimeType: 'application/octet-stream',
      fileSize: 1,
    };
    const result = await setExecutor.execute({
      config: { fields: { status: 'ready' } },
      inputItems: [{ json: { id: 1 }, binary: { data: attachment } }],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ id: 1, status: 'ready' });
    expect(result.outputItems?.[0]?.[0]?.binary?.data).toEqual(attachment);
  });
});
