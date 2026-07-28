import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { errorTriggerExecutor } from './error.js';

describe('errorTriggerExecutor registration', () => {
  it('registerBuiltinExecutors registers errorTrigger', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('errorTrigger')).toBe(true);
  });
});

describe('errorTriggerExecutor', () => {
  it('throws E2002 when errorPayload is missing', async () => {
    await expect(
      errorTriggerExecutor.execute({
        config: {},
        inputItems: [],
      }),
    ).rejects.toBeInstanceOf(AwfError);
    await expect(
      errorTriggerExecutor.execute({
        config: {},
        inputItems: [],
      }),
    ).rejects.toMatchObject({
      code: 'E2002',
      message: 'errorTrigger requires errorPayload',
    });
  });

  it('maps error workflow payload to initial items', async () => {
    const result = await errorTriggerExecutor.execute({
      config: {},
      inputItems: [],
      errorPayload: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        failedNode: 'http-1',
        errorMessage: 'boom',
        stack: 'Error: boom',
        timestamp: '2026-05-20T00:00:00Z',
      },
    });
    expect(result.outputItems?.[0]?.[0]?.json).toMatchObject({
      executionId: 'ex-1',
      failedNode: 'http-1',
      errorMessage: 'boom',
    });
  });
});
