import { describe, it, expect } from 'vitest';
import { getFieldMode, setFieldMode } from './field-modes.js';

describe('field-modes', () => {
  it('defaults to fixed', () => {
    expect(getFieldMode({}, 'url')).toBe('fixed');
  });

  it('defaults expression fields to expression mode', () => {
    expect(getFieldMode({}, 'condition', { defaultExpression: true })).toBe(
      'expression',
    );
  });

  it('persists expression mode', () => {
    const p = setFieldMode({}, 'url', 'expression');
    expect(getFieldMode(p, 'url')).toBe('expression');
  });
});
