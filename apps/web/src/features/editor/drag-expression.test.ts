import { describe, it, expect } from 'vitest';
import {
  buildContextDragExpression,
  buildDragExpression,
  buildJsonDragExpression,
  toCodeJsInsertText,
} from './drag-expression.js';

describe('buildDragExpression', () => {
  it('builds bracket node reference with json path', () => {
    expect(buildDragExpression('HTTP', ['body', 'id'])).toBe(
      '{{ $nodes["HTTP"].json.body.id }}',
    );
  });
});

describe('template vs code insert', () => {
  it('builds {{ }} for context and json paths', () => {
    expect(buildContextDragExpression(['$vars', 'aa'])).toBe('{{ $vars.aa }}');
    expect(buildJsonDragExpression(['id'])).toBe('{{ $json.id }}');
  });

  it('strips {{ }} for Code JS insert', () => {
    expect(toCodeJsInsertText('{{ $vars.aa }}')).toBe('$vars.aa');
    expect(toCodeJsInsertText('{{ $nodes["HTTP"].json.body.id }}')).toBe(
      '$nodes["HTTP"].json.body.id',
    );
    expect(toCodeJsInsertText('$already.bare')).toBe('$already.bare');
  });
});
