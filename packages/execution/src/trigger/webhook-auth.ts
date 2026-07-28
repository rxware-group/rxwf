import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookAuthMode = 'none' | 'apiKey' | 'apiKeyHmac';

export const WEBHOOK_API_KEY_HEADER = 'x-rxwf-api-key';

export interface WebhookAuthConfig {
  authMode: WebhookAuthMode;
  apiKey: string;
  hmacSecret: string;
}

export interface WebhookAuthVerifyInput {
  config: WebhookAuthConfig;
  apiKeyHeader: string;
  signature: string;
  timestamp: string;
  body: string | Buffer;
  nowMs: number;
  maxTimestampSkewMs: number;
}

export type WebhookAuthVerifyResult =
  | { ok: true }
  | { ok: false; status: 401; code: 'E2005' | 'E2006' | 'E2014' };

/** Parse webhookTrigger node parameters into auth config (legacy-aware). */
export function parseWebhookAuthFromParameters(
  parameters: Record<string, unknown>,
): WebhookAuthConfig {
  const authMode = resolveWebhookAuthMode(parameters);
  return {
    authMode,
    apiKey: String(parameters.apiKey ?? '').trim(),
    hmacSecret: String(parameters.hmacSecret ?? '').trim(),
  };
}

export function resolveWebhookAuthMode(
  parameters: Record<string, unknown>,
): WebhookAuthMode {
  const raw = String(parameters.authMode ?? '').trim();
  if (raw === 'none' || raw === 'apiKey' || raw === 'apiKeyHmac') {
    return raw;
  }
  if (String(parameters.hmacSecret ?? '').trim()) {
    return 'apiKeyHmac';
  }
  return 'none';
}

function verifyApiKey(provided: string, expected: string): boolean {
  if (!expected) return false;
  try {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isTimestampValid(
  timestampHeader: string,
  nowMs: number,
  maxSkewMs: number,
): boolean {
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const requestMs = ts < 1_000_000_000_000 ? ts * 1000 : ts;
  return Math.abs(nowMs - requestMs) <= maxSkewMs;
}

function verifyHmac(body: string | Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyWebhookAuth(input: WebhookAuthVerifyInput): WebhookAuthVerifyResult {
  const { config } = input;

  if (config.authMode === 'none') {
    return { ok: true };
  }

  if (config.authMode === 'apiKey') {
    if (!config.apiKey) {
      return { ok: false, status: 401, code: 'E2014' };
    }
    if (!verifyApiKey(input.apiKeyHeader, config.apiKey)) {
      return { ok: false, status: 401, code: 'E2014' };
    }
    return { ok: true };
  }

  // apiKeyHmac — legacy nodes may have only hmacSecret configured.
  const requiresApiKey = Boolean(config.apiKey);
  const requiresHmac = Boolean(config.hmacSecret);

  if (!requiresApiKey && !requiresHmac) {
    return { ok: false, status: 401, code: 'E2005' };
  }

  if (requiresApiKey) {
    if (!verifyApiKey(input.apiKeyHeader, config.apiKey)) {
      return { ok: false, status: 401, code: 'E2014' };
    }
  }

  if (requiresHmac) {
    if (!isTimestampValid(input.timestamp, input.nowMs, input.maxTimestampSkewMs)) {
      return { ok: false, status: 401, code: 'E2006' };
    }
    if (!verifyHmac(input.body, input.signature, config.hmacSecret)) {
      return { ok: false, status: 401, code: 'E2005' };
    }
  }

  return { ok: true };
}
