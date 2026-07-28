export type HitlTimeoutAction = 'approve' | 'reject';

export interface HitlMetadata {
  timeoutMs?: number;
  timeoutAction?: HitlTimeoutAction;
  requestedAt?: string;
  expiresAt?: string;
  decision?: string;
}

export function parseHitlMetadata(
  metadata: Record<string, unknown> | null | undefined,
): HitlMetadata | null {
  const hitl = metadata?.hitl;
  if (!hitl || typeof hitl !== 'object') return null;
  return hitl as HitlMetadata;
}

export function isHitlExpired(hitl: HitlMetadata, nowMs: number): boolean {
  if (hitl.decision) return false;
  if (!hitl.expiresAt) return false;
  const expiresMs = Date.parse(hitl.expiresAt);
  if (Number.isNaN(expiresMs)) return false;
  return nowMs >= expiresMs;
}

export function resolveHitlTimeoutDecision(hitl: HitlMetadata): HitlTimeoutAction {
  return hitl.timeoutAction === 'approve' ? 'approve' : 'reject';
}
