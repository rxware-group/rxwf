import { describe, expect, it } from 'vitest';
import { shouldSkipEmptyInput } from './should-skip-empty-input.js';

describe('shouldSkipEmptyInput', () => {
  it('does not skip nodes with no incoming edges', () => {
    expect(shouldSkipEmptyInput('manualTrigger', 0, [], undefined)).toBe(false);
    expect(shouldSkipEmptyInput('set', 0, [{ json: {} }], undefined)).toBe(false);
  });

  it('skips non-merge nodes when inputItems is empty', () => {
    expect(shouldSkipEmptyInput('httpRequest', 1, [], undefined)).toBe(true);
    expect(shouldSkipEmptyInput('set', 1, [{ json: { x: 1 } }], undefined)).toBe(false);
  });

  it('skips merge only when all input branches are empty', () => {
    expect(
      shouldSkipEmptyInput('merge', 2, [], [[], []]),
    ).toBe(true);
    expect(
      shouldSkipEmptyInput('merge', 2, [], [[{ json: { a: 1 } }], []]),
    ).toBe(false);
    expect(
      shouldSkipEmptyInput('merge', 2, [], [[], [{ json: { b: 2 } }]]),
    ).toBe(false);
  });
});
