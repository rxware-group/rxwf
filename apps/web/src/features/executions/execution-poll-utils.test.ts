import { describe, expect, it } from 'vitest';
import { isTerminalExecutionStatus } from './execution-poll-utils.js';

describe('isTerminalExecutionStatus', () => {
  it('returns true for finished execution statuses', () => {
    expect(isTerminalExecutionStatus('success')).toBe(true);
    expect(isTerminalExecutionStatus('failed')).toBe(true);
    expect(isTerminalExecutionStatus('cancelled')).toBe(true);
  });

  it('returns false for in-progress statuses', () => {
    expect(isTerminalExecutionStatus('running')).toBe(false);
    expect(isTerminalExecutionStatus('waiting')).toBe(false);
    expect(isTerminalExecutionStatus('queued')).toBe(false);
  });
});
