import { describe, it, expect, vi } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { createCodeExecutor } from './code.js';
import { registerBuiltinExecutors } from './register-builtin.js';

describe('codeExecutor', () => {
  it('is registered via registerBuiltinExecutors', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('code')).toBe(true);
  });

  it('throws E2003 when code executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('code', { config: {}, inputItems: [{ json: {} }] }),
    ).rejects.toMatchObject({ code: 'E2003', message: expect.stringContaining('code') });
  });

  it('delegates to sandbox and returns output items', async () => {
    const runInSandbox = vi.fn(async () => ({
      items: [{ json: { computed: 42 } }],
      logs: [
        {
          level: 'info' as const,
          message: 'hi',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ],
    }));
    const executor = createCodeExecutor({ runInSandbox });
    const upstreamNodes = [
      {
        name: 'Upstream',
        json: { tag: 'a' },
        items: [{ json: { tag: 'a' } }],
      },
    ];
    const result = await executor.execute({
      config: { jsCode: 'return [{ json: { computed: 42 } }];' },
      inputItems: [{ json: { x: 1 } }],
      env: { FLAG: 'yes' },
      nodes: upstreamNodes,
    });
    expect(runInSandbox).toHaveBeenCalledWith({
      code: 'return [{ json: { computed: 42 } }];',
      inputItems: [{ json: { x: 1 } }],
      env: { FLAG: 'yes' },
      vars: undefined,
      nodes: upstreamNodes,
      timeoutMs: -1,
      execution: undefined,
      workflow: undefined,
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ computed: 42 });
    expect(result.logs).toHaveLength(1);
  });

  it('reads legacy config.code when jsCode is absent', async () => {
    const runInSandbox = vi.fn(async () => ({
      items: [{ json: { ok: true } }],
      logs: [],
    }));
    const executor = createCodeExecutor({ runInSandbox });
    await executor.execute({
      config: { code: 'return [{ json: { ok: true } }];' },
      inputItems: [{ json: {} }],
    });
    expect(runInSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'return [{ json: { ok: true } }];' }),
    );
  });

  it('passes execution and workflow meta to sandbox', async () => {
    const runInSandbox = vi.fn(async () => ({
      items: [{ json: { mode: 'manual' } }],
      logs: [],
    }));
    const executor = createCodeExecutor({ runInSandbox });
    await executor.execute({
      config: { jsCode: 'return [{ json: { mode: $execution.mode } }];' },
      inputItems: [{ json: {} }],
      executionId: 'exec-1',
      executionMode: 'manual',
      executionEnvironment: 'test',
      workflowId: 'wf-1',
      workflowDefinition: { schemaVersion: 1, name: 'Code Flow', nodes: [], connections: [] },
    });
    expect(runInSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        execution: { id: 'exec-1', mode: 'manual', environment: 'test' },
        workflow: { id: 'wf-1', name: 'Code Flow' },
      }),
    );
  });

  it('applies timeoutMs from node config', async () => {
    const runInSandbox = vi.fn(async () => ({
      items: [{ json: {} }],
      logs: [],
    }));
    const executor = createCodeExecutor({ runInSandbox });
    await executor.execute({
      config: { jsCode: 'return [{ json: {} }];', timeoutMs: 8000 },
      inputItems: [{ json: {} }],
    });
    expect(runInSandbox).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 8000 }));
  });

  it('propagates sandbox AwfError E2002', async () => {
    const runInSandbox = vi.fn(async () => {
      throw new AwfError('E2002', 'Sandbox execution timed out');
    });
    const executor = createCodeExecutor({ runInSandbox });
    await expect(
      executor.execute({
        config: { jsCode: 'while(true){}' },
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E2002' });
  });

  it('returns sandbox items including binary', async () => {
    const runInSandbox = vi.fn(async () => ({
      items: [
        {
          json: { ok: true },
          binary: {
            data: {
              data: Buffer.from('x').toString('base64'),
              mimeType: 'text/plain',
              fileSize: 1,
            },
          },
        },
      ],
      logs: [],
    }));
    const executor = createCodeExecutor({ runInSandbox });
    const result = await executor.execute({
      config: { jsCode: 'return [{ json: { ok: true }, binary: { data: { ... } } }];' },
      inputItems: [{ json: {} }],
    });
    expect(result.outputItems?.[0]?.[0]?.binary?.data?.mimeType).toBe('text/plain');
  });
});
