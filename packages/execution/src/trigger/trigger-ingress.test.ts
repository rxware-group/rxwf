import { describe, it, expect, vi } from 'vitest';
import { createTriggerIngress } from './trigger-ingress.js';
import { createHmac } from 'node:crypto';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('createTriggerIngress', () => {
  it('allows none auth without credentials', async () => {
    const enqueue = vi.fn(async () => ({
      executionId: 'ex-open',
      status: 'success',
    }));
    const ingress = createTriggerIngress({
      enqueue,
      idempotency: { find: vi.fn(async () => null) },
    });
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'none', apiKey: '', hmacSecret: '' },
      body: '{}',
      signature: '',
      apiKeyHeader: '',
      idempotencyKey: 'open-key',
      timestamp: '',
    });
    expect(result.status).toBe(202);
    expect(enqueue).toHaveBeenCalled();
  });

  it('rejects webhook when timestamp is outside allowed skew (E2006)', async () => {
    const ingress = createTriggerIngress({
      enqueue: vi.fn(),
      idempotency: { find: vi.fn() },
      maxTimestampSkewMs: 60_000,
      now: () => 1_700_000_000_000,
    });
    const body = '{"a":1}';
    const staleTs = String(Math.floor(1_700_000_000_000 / 1000) - 120);
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: 'secret' },
      body,
      signature: sign(body, 'secret'),
      apiKeyHeader: '',
      idempotencyKey: 'key-stale',
      timestamp: staleTs,
    });
    expect(result.status).toBe(401);
    if (result.status === 401) expect(result.code).toBe('E2006');
  });

  it('rejects webhook when HMAC signature is invalid', async () => {
    const ingress = createTriggerIngress({
      enqueue: vi.fn(),
      idempotency: { find: vi.fn() },
    });
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: 'secret' },
      body: '{"a":1}',
      signature: 'bad',
      apiKeyHeader: '',
      idempotencyKey: 'key-1',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    expect(result.status).toBe(401);
    if (result.status === 401) expect(result.code).toBe('E2005');
  });

  it('rejects apiKey mode when header is missing', async () => {
    const ingress = createTriggerIngress({
      enqueue: vi.fn(),
      idempotency: { find: vi.fn() },
    });
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKey', apiKey: 'secret-key', hmacSecret: '' },
      body: '{}',
      signature: '',
      apiKeyHeader: '',
      idempotencyKey: 'key-api',
      timestamp: '',
    });
    expect(result.status).toBe(401);
    if (result.status === 401) expect(result.code).toBe('E2014');
  });

  it('returns cached execution when idempotency key already completed', async () => {
    const enqueue = vi.fn();
    const find = vi.fn(async () => ({
      executionId: 'ex-existing',
      status: 'success',
    }));
    const ingress = createTriggerIngress({
      enqueue,
      idempotency: { find },
    });
    const body = '{"a":1}';
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: 'secret' },
      body,
      signature: sign(body, 'secret'),
      apiKeyHeader: '',
      idempotencyKey: 'dup-key',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    expect(result.status).toBe(200);
    if (result.status === 200) expect(result.executionId).toBe('ex-existing');
    expect(enqueue).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith('dup-key', 'webhook:production');
  });

  it('allows test webhook when unpublished', async () => {
    const enqueue = vi.fn(async () => ({
      executionId: 'ex-test',
      status: 'success',
    }));
    const ingress = createTriggerIngress({
      enqueue,
      idempotency: { find: vi.fn(async () => null) },
    });
    const body = '{}';
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: false,
      testMode: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: 'secret' },
      body,
      signature: sign(body, 'secret'),
      apiKeyHeader: '',
      idempotencyKey: 'test-key',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    expect(result.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ mode: 'manual' }));
  });

  it('rejects apiKeyHmac when neither credential is configured (E2005)', async () => {
    const ingress = createTriggerIngress({
      enqueue: vi.fn(),
      idempotency: { find: vi.fn() },
    });
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: '' },
      body: '{}',
      signature: 'x',
      apiKeyHeader: '',
      idempotencyKey: 'k',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    expect(result.status).toBe(401);
    if (result.status === 401) expect(result.code).toBe('E2005');
  });

  it('enqueues webhook via shared job pipeline with triggerType webhook', async () => {
    const enqueue = vi.fn(async () => ({
      executionId: 'ex-new',
      status: 'success',
    }));
    const ingress = createTriggerIngress({
      enqueue,
      idempotency: { find: vi.fn(async () => null) },
    });
    const body = '{"event":"order.created"}';
    const result = await ingress.handleWebhook({
      workflowId: 'wf-1',
      published: true,
      auth: { authMode: 'apiKeyHmac', apiKey: '', hmacSecret: 'secret' },
      body,
      signature: sign(body, 'secret'),
      apiKeyHeader: '',
      idempotencyKey: 'key-new',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });
    expect(result.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-1',
        triggerType: 'webhook',
        mode: 'production',
        idempotencyKey: 'key-new',
        body,
      }),
    );
    if (result.status === 202) {
      expect(result.executionId).toBe('ex-new');
    }
  });
});
