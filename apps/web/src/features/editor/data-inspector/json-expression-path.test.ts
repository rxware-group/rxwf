import { describe, expect, it } from 'vitest';
import { toExpressionPath } from './json-expression-path.js';

describe('toExpressionPath', () => {
  it('strips leading item index for multi-item arrays', () => {
    expect(toExpressionPath(['0', 'round'], 3)).toEqual(['round']);
    expect(toExpressionPath(['2', 'messages', '1', 'content'], 3)).toEqual([
      'messages',
      '1',
      'content',
    ]);
  });

  it('keeps nested array indices after the item index is removed', () => {
    expect(toExpressionPath(['1', 'messages', '0', 'role'], 3)).toEqual([
      'messages',
      '0',
      'role',
    ]);
  });

  it('does not strip when index is outside item range', () => {
    expect(toExpressionPath(['9', 'round'], 3)).toEqual(['9', 'round']);
  });
});
