import { describe, it, expect } from 'vitest';
import { isCronDue } from './is-cron-due.js';

describe('isCronDue', () => {
  it('returns true when cron fires in the current minute', () => {
    const now = new Date('2026-05-20T10:00:30.000Z');
    expect(isCronDue('0 10 * * *', now, 'UTC')).toBe(true);
  });

  it('returns false when cron fired in a previous minute', () => {
    const now = new Date('2026-05-20T10:01:00.000Z');
    expect(isCronDue('0 10 * * *', now, 'UTC')).toBe(false);
  });

  it('returns false for invalid cron expressions', () => {
    const now = new Date('2026-05-20T10:00:00.000Z');
    expect(isCronDue('not-a-cron', now, 'UTC')).toBe(false);
  });
});
