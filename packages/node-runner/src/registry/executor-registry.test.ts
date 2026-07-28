import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { createExecutorRegistry } from './executor-registry.js';
import type { NodeExecutor } from '../types/node-executor.js';

describe('ExecutorRegistry', () => {
  it('throws E2003 for unknown node type', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('unknownType', {
        config: {},
        inputItems: [{ json: {} }],
      }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('executes registered executor', async () => {
    const stub: NodeExecutor = {
      type: 'stub',
      async execute() {
        return { status: 'success', outputItems: [[{ json: { ok: true } }]] };
      },
    };
    const registry = createExecutorRegistry([stub]);
    const result = await registry.execute('stub', {
      config: {},
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ ok: true });
  });
});
