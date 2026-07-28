import { describe, expect, it } from 'vitest';
import { AwfError, formatErrorDetail } from './errors.js';

describe('formatErrorDetail', () => {
  it('includes AwfError code and unwraps cause chain', () => {
    const root = new Error('connect ECONNREFUSED 127.0.0.1:11434');
    const err = new AwfError('E3001', 'fetch failed');
    (err as Error & { cause?: unknown }).cause = root;
    expect(formatErrorDetail(err)).toBe(
      '[E3001] fetch failed\nCaused by: connect ECONNREFUSED 127.0.0.1:11434',
    );
  });

  it('returns plain message for non-error values', () => {
    expect(formatErrorDetail('boom')).toBe('boom');
  });
});
