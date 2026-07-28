import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  parseWebhookAuthFromParameters,
  resolveWebhookAuthMode,
  verifyWebhookAuth,
} from './webhook-auth.js';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('webhook auth', () => {
  it('defaults legacy nodes with hmacSecret to apiKeyHmac', () => {
    expect(resolveWebhookAuthMode({ hmacSecret: 'abc' })).toBe('apiKeyHmac');
    expect(resolveWebhookAuthMode({})).toBe('none');
  });

  it('allows none mode without credentials', () => {
    const result = verifyWebhookAuth({
      config: { authMode: 'none', apiKey: '', hmacSecret: '' },
      apiKeyHeader: '',
      signature: '',
      timestamp: '',
      body: '{}',
      nowMs: Date.now(),
      maxTimestampSkewMs: 300_000,
    });
    expect(result).toEqual({ ok: true });
  });

  it('requires api key in apiKey mode', () => {
    const body = '{}';
    const fail = verifyWebhookAuth({
      config: { authMode: 'apiKey', apiKey: 'key-1', hmacSecret: '' },
      apiKeyHeader: 'wrong',
      signature: '',
      timestamp: '',
      body,
      nowMs: Date.now(),
      maxTimestampSkewMs: 300_000,
    });
    expect(fail).toEqual({ ok: false, status: 401, code: 'E2014' });

    const ok = verifyWebhookAuth({
      config: { authMode: 'apiKey', apiKey: 'key-1', hmacSecret: '' },
      apiKeyHeader: 'key-1',
      signature: '',
      timestamp: '',
      body,
      nowMs: Date.now(),
      maxTimestampSkewMs: 300_000,
    });
    expect(ok).toEqual({ ok: true });
  });

  it('requires both api key and hmac in apiKeyHmac mode', () => {
    const body = '{"a":1}';
    const secret = 'hmac-secret';
    const ts = String(Math.floor(Date.now() / 1000));
    const config = parseWebhookAuthFromParameters({
      authMode: 'apiKeyHmac',
      apiKey: 'api-key',
      hmacSecret: secret,
    });

    const ok = verifyWebhookAuth({
      config,
      apiKeyHeader: 'api-key',
      signature: sign(body, secret),
      timestamp: ts,
      body,
      nowMs: Date.now(),
      maxTimestampSkewMs: 300_000,
    });
    expect(ok).toEqual({ ok: true });
  });

  it('supports legacy apiKeyHmac with hmac only', () => {
    const body = '{}';
    const secret = 'legacy';
    const config = parseWebhookAuthFromParameters({ hmacSecret: secret });
    expect(config.authMode).toBe('apiKeyHmac');

    const ok = verifyWebhookAuth({
      config,
      apiKeyHeader: '',
      signature: sign(body, secret),
      timestamp: String(Math.floor(Date.now() / 1000)),
      body,
      nowMs: Date.now(),
      maxTimestampSkewMs: 300_000,
    });
    expect(ok).toEqual({ ok: true });
  });
});
