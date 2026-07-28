import { describe, expect, it } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { subworkflowTriggerExecutor } from './subworkflow.js';

describe('subworkflowTrigger registry', () => {
  it('throws E2003 when subworkflowTrigger executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('subworkflowTrigger', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable via registerBuiltinExecutors', async () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('subworkflowTrigger')).toBe(true);

    const result = await registry.execute('subworkflowTrigger', {
      config: { inputMode: 'acceptAll' },
      inputItems: [{ json: { query: 'hello' } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { query: 'hello' } }]);
  });
});

describe('subworkflowTriggerExecutor', () => {
  it('passes through inputItems from parent workflow', async () => {
    const result = await subworkflowTriggerExecutor.execute({
      config: {},
      inputItems: [{ json: { query: 'hello' } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { query: 'hello' } }]);
  });

  it('emits empty item when no inputItems', async () => {
    const result = await subworkflowTriggerExecutor.execute({
      config: {},
      inputItems: [],
    });
    expect(result.outputItems?.[0]).toEqual([{ json: {} }]);
  });
});
