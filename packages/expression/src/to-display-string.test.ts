import { describe, it, expect } from 'vitest';
import { toDisplayString } from './to-display-string.js';

describe('toDisplayString', () => {
  it('formats null/undefined as empty', () => {
    expect(toDisplayString(null)).toBe('');
    expect(toDisplayString(undefined)).toBe('');
  });

  it('formats primitives', () => {
    expect(toDisplayString('hi')).toBe('hi');
    expect(toDisplayString(42)).toBe('42');
    expect(toDisplayString(true)).toBe('true');
  });

  it('formats object/array as JSON', () => {
    expect(toDisplayString({ a: 1 })).toBe('{"a":1}');
    expect(toDisplayString([1, 2])).toBe('[1,2]');
  });

  it('formats binary map as placeholder', () => {
    expect(
      toDisplayString({ avatar: { data: 'abc', mimeType: 'image/png' } }),
    ).toBe('[binary:avatar]');
  });
});
