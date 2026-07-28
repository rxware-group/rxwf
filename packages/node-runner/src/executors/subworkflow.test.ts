import { describe, it, expect, vi } from 'vitest';
import { validateWorkflowDefinition } from '@rxwf/workflow';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerBuiltinExecutors } from './register-builtin.js';
import { createSubworkflowExecutor } from './subworkflow.js';

describe('executeWorkflow registry', () => {
  it('fails with E2003 when executeWorkflow executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('executeWorkflow', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('registers executeWorkflow when subworkflow deps are provided', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry, {
      subworkflow: { runChild: vi.fn() },
    });
    expect(registry.has('executeWorkflow')).toBe(true);
  });
});

describe('createSubworkflowExecutor', () => {
  it('rejects when workflowId is empty', async () => {
    const runChild = vi.fn();
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: '' },
      inputItems: [{ json: {} }],
      parentExecutionId: 'parent-ex-1',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
    expect(result.errorMessage).toContain('workflowId');
    expect(runChild).not.toHaveBeenCalled();
  });

  it('uses executionId as parentExecutionId fallback for debug runs', async () => {
    const runChild = vi.fn(async () => ({
      executionId: 'child-ex-1',
      outputItems: [{ json: { ok: true } }],
    }));
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: { x: 1 } }],
      executionId: 'debug-ex-1',
    });
    expect(result.status).toBe('success');
    expect(runChild).toHaveBeenCalledWith(
      expect.objectContaining({
        parentExecutionId: 'debug-ex-1',
        workflowId: 'wf-child',
      }),
    );
  });

  it('rejects when parentExecutionId is missing', async () => {
    const runChild = vi.fn();
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
    expect(result.errorMessage).toContain('parentExecutionId');
    expect(runChild).not.toHaveBeenCalled();
  });

  it('rejects when subworkflow depth exceeds 5', async () => {
    const runChild = vi.fn();
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: { x: 1 } }],
      subworkflowDepth: 5,
      parentExecutionId: 'parent-ex-1',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2008');
    expect(runChild).not.toHaveBeenCalled();
  });

  it('returns E1054 when required child input field is missing', async () => {
    const runChild = vi.fn();
    const loadPublishedWorkflowDefinition = vi.fn(async () => ({
      schemaVersion: 1 as const,
      name: 'Child',
      nodes: [
        {
          id: 'st1',
          type: 'subworkflowTrigger',
          name: 'Sub Trigger',
          position: { x: 0, y: 0 },
          parameters: {
            inputMode: 'fields',
            inputs: [{ name: 'query', type: 'string', required: true }],
            jsonExample: {},
          },
        },
      ],
      connections: [],
    }));
    const executor = createSubworkflowExecutor({ runChild, loadPublishedWorkflowDefinition });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: {} }],
      parentExecutionId: 'parent-ex-1',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E1054');
    expect(runChild).not.toHaveBeenCalled();
  });

  it('runs child workflow via port and returns output items', async () => {
    const runChild = vi.fn(async () => ({
      executionId: 'child-ex-1',
      outputItems: [{ json: { done: true } }],
    }));
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: { x: 1 } }],
      subworkflowDepth: 2,
      parentExecutionId: 'parent-ex-1',
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { done: true } }]);
    expect(runChild).toHaveBeenCalledWith({
      workflowId: 'wf-child',
      parentExecutionId: 'parent-ex-1',
      depth: 3,
      inputItems: [{ json: { x: 1 } }],
    });
  });

  it('returns failed when runChild rejects', async () => {
    const runChild = vi.fn(async () => {
      throw new Error('child failed');
    });
    const executor = createSubworkflowExecutor({ runChild });
    const result = await executor.execute({
      config: { workflowId: 'wf-child' },
      inputItems: [{ json: {} }],
      parentExecutionId: 'parent-ex-1',
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
  });
});

describe('executeWorkflow validation', () => {
  it('emits E1003 when nesting depth is at maximum during save validation', () => {
    const result = validateWorkflowDefinition(
      {
        schemaVersion: 1,
        name: 'nested-sub',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'sw1',
            type: 'executeWorkflow',
            name: 'Child',
            position: { x: 1, y: 0 },
            parameters: { workflowId: 'wf-child' },
          },
        ],
        connections: [],
      },
      { subworkflowDepth: 5 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1003')).toBe(true);
    }
  });
});
