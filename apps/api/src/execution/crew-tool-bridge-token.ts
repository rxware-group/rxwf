import { createHmac, timingSafeEqual } from 'node:crypto';

export function createCrewToolBridgeToken(input: {
  secret: string;
  executionId: string;
  bridgeId: string;
  expiresAtMs: number;
}): string {
  const payload = `${input.executionId}:${input.bridgeId}:${input.expiresAtMs}`;
  const sig = createHmac('sha256', input.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyCrewToolBridgeToken(
  secret: string,
  token: string,
  executionId: string,
  bridgeId: string,
): boolean {
  if (!token || !executionId || !bridgeId) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const parts = decoded.split(':');
  if (parts.length < 4) return false;

  const sig = parts.pop()!;
  const expiresRaw = parts.pop()!;
  const tokExecutionId = parts.shift()!;
  const tokBridgeId = parts.join(':');
  if (!sig || !tokExecutionId || !tokBridgeId) return false;
  if (tokExecutionId !== executionId || tokBridgeId !== bridgeId) return false;

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const payload = `${tokExecutionId}:${tokBridgeId}:${expiresRaw}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
