import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { manualTriggerExecutor, parseManualTriggerOutput } from './manual.js';

describe('manualTrigger registry', () => {
  it('throws E2003 when manualTrigger executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('manualTrigger', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable via registerBuiltinExecutors', async () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('manualTrigger')).toBe(true);

    const result = await registry.execute('manualTrigger', {
      config: { json: { ping: 1 } },
      inputItems: [],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { ping: 1 } }]);
  });
});

describe('manualTriggerExecutor', () => {
  it('emits a single empty item when json is unset', async () => {
    const result = await manualTriggerExecutor.execute({
      config: {},
      inputItems: [],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: {} }]);
  });

  it('emits configured json object', async () => {
    const result = await manualTriggerExecutor.execute({
      config: { json: { orderId: '42', active: true } },
      inputItems: [],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: { orderId: '42', active: true } }]);
  });

  it('emits multiple items when json is an array', async () => {
    const result = await manualTriggerExecutor.execute({
      config: { json: [{ id: 1 }, { id: 2 }] },
      inputItems: [],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: { id: 1 } }, { json: { id: 2 } }]);
  });
});

describe('parseManualTriggerOutput', () => {
  it('parses JSON string', () => {
    expect(parseManualTriggerOutput({ json: '{"a":1}' })).toEqual([{ json: { a: 1 } }]);
  });

  it('throws E1002 for invalid JSON string', () => {
    expect(() => parseManualTriggerOutput({ json: '{ invalid' })).toThrow(
      expect.objectContaining({ code: 'E1002' }),
    );
  });
});
