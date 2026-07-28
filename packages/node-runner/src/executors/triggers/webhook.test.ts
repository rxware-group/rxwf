import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { webhookItemsFromContext, webhookTriggerExecutor } from './webhook.js';

describe('webhookTriggerExecutor registration', () => {
  it('is registered via registerBuiltinExecutors', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('webhookTrigger')).toBe(true);
    expect(webhookTriggerExecutor.type).toBe('webhookTrigger');
  });
});

describe('webhookItemsFromContext', () => {
  it('emits empty json item when body and inputItems are absent', () => {
    expect(webhookItemsFromContext([], undefined)).toEqual([{ json: {} }]);
    expect(webhookItemsFromContext([], null)).toEqual([{ json: {} }]);
  });
});

describe('webhookTriggerExecutor', () => {
  it('passes through request body as item json', async () => {
    const result = await webhookTriggerExecutor.execute({
      config: { body: { orderId: '42' } },
      inputItems: [],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toEqual([{ json: { orderId: '42' } }]);
  });

  it('passes through input items including binary', async () => {
    const inputItems = [
      {
        json: { title: 'upload' },
        binary: {
          file: {
            data: Buffer.from('bytes').toString('base64'),
            mimeType: 'text/plain',
            fileSize: 5,
          },
        },
      },
    ];
    const result = await webhookTriggerExecutor.execute({
      config: { body: { ignored: true } },
      inputItems,
    });
    expect(result.outputItems?.[0]).toEqual(inputItems);
  });
});
