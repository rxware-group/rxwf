import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { waitExecutor } from './wait.js';

describe('waitExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits config.ms milliseconds then passes items through', async () => {
    const promise = waitExecutor.execute({
      config: { ms: 250 },
      inputItems: [{ json: { x: 1 } }],
    });
    await vi.advanceTimersByTimeAsync(250);
    const result = await promise;
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { x: 1 } }]);
  });

  it('ms=0 passes items through without delay', async () => {
    const promise = waitExecutor.execute({
      config: { ms: 0 },
      inputItems: [{ json: { ok: true } }],
    });
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { ok: true } }]);
  });

  it('rejects negative ms with E2003', async () => {
    await expect(
      waitExecutor.execute({
        config: { ms: -1 },
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E2003' } satisfies Partial<AwfError>);
  });

  it('is registered in builtin executor registry', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('wait')).toBe(true);
  });
});
