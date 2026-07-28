import { describe, expect, it } from 'vitest';
import { validateWorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { loopExecutor } from './loop.js';

describe('loopExecutor registry', () => {
  it('fails with E2003 when loop executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('loop', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('registers loop in builtin executor registry', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('loop')).toBe(true);
  });
});

describe('loopExecutor', () => {
  it('returns success stub with dual empty outputs (engine handles iteration)', async () => {
    const result = await loopExecutor.execute({
      config: { batchSize: 2 },
      inputItems: [{ json: { i: 1 } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems).toEqual([[], []]);
  });
});

describe('loop validation', () => {
  const loopNode = {
    id: 'loop1',
    type: 'loop',
    name: 'Loop',
    position: { x: 0, y: 0 },
    parameters: { batchSize: 1 },
  };

  it('emits E2002 when loop body output is not connected', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 'loop-missing-body',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        loopNode,
        {
          id: 'done1',
          type: 'set',
          name: 'Done',
          position: { x: 200, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'loop1' },
        { from: 'loop1', to: 'done1', fromOutput: '1' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E2002')).toBe(true);
    }
  });

  it('emits W1020 when done output is not connected', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 'loop-missing-done',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        loopNode,
        {
          id: 'body1',
          type: 'set',
          name: 'Body',
          position: { x: 200, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'loop1' },
        { from: 'loop1', to: 'body1', fromOutput: '0' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === 'W1020')).toBe(true);
  });
});
