import { describe, expect, it } from 'vitest';
import { formatWebhookListenError, isWebhookAuthErrorCode } from './webhook-listen-error.js';

describe('webhook listen error', () => {
  it('formats error with localized code message', () => {
    const text = formatWebhookListenError(
      { code: 'E2005', message: 'Webhook signature verification failed' },
      { 'errors.E2005': 'Webhook 签名校验失败' },
    );
    expect(text).toBe('E2005 · Webhook 签名校验失败');
  });

  it('detects webhook auth error codes', () => {
    expect(isWebhookAuthErrorCode('E2014')).toBe(true);
    expect(isWebhookAuthErrorCode('E2000')).toBe(false);
  });
});
