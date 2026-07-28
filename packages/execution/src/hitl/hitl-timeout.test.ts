import { describe, expect, it } from 'vitest';
import {
  isHitlExpired,
  parseHitlMetadata,
  resolveHitlTimeoutDecision,
} from './hitl-timeout.js';

describe('hitl-timeout', () => {
  it('parseHitlMetadata returns null for missing hitl', () => {
    expect(parseHitlMetadata(null)).toBeNull();
    expect(parseHitlMetadata({})).toBeNull();
  });

  it('isHitlExpired is false before expiresAt', () => {
    const hitl = {
      expiresAt: '2026-05-29T12:00:01.000Z',
      requestedAt: '2026-05-29T12:00:00.000Z',
    };
    expect(isHitlExpired(hitl, Date.parse('2026-05-29T12:00:00.500Z'))).toBe(false);
  });

  it('isHitlExpired is true at or after expiresAt', () => {
    const hitl = { expiresAt: '2026-05-29T12:00:01.000Z' };
    expect(isHitlExpired(hitl, Date.parse('2026-05-29T12:00:01.000Z'))).toBe(true);
    expect(isHitlExpired(hitl, Date.parse('2026-05-29T12:00:02.000Z'))).toBe(true);
  });

  it('isHitlExpired is false when decision already recorded', () => {
    const hitl = {
      expiresAt: '2026-05-29T12:00:00.000Z',
      decision: 'approve',
    };
    expect(isHitlExpired(hitl, Date.parse('2026-05-29T13:00:00.000Z'))).toBe(false);
  });

  it('resolveHitlTimeoutDecision defaults to reject', () => {
    expect(resolveHitlTimeoutDecision({})).toBe('reject');
    expect(resolveHitlTimeoutDecision({ timeoutAction: 'approve' })).toBe('approve');
  });
});
