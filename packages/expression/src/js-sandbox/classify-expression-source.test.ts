import { describe, it, expect } from 'vitest';
import {
  classifyExpressionSource,
  expressionSourceFromProgram,
  parseExpressionProgram,
  hasReturnStatement,
} from './classify-expression-source.js';

describe('classifyExpressionSource', () => {
  it('classifies single expression', () => {
    expect(classifyExpressionSource('$json.count')).toBe('expression');
    expect(classifyExpressionSource('$json.count;')).toBe('expression');
    expect(classifyExpressionSource('await $json.count')).toBe('expression');
  });

  it('classifies return-prefixed as statement-block', () => {
    expect(classifyExpressionSource('return $json.count')).toBe('statement-block');
  });

  it('classifies semicolon-separated statements as statement-block', () => {
    expect(classifyExpressionSource('const a = 1; return a')).toBe(
      'statement-block',
    );
  });

  it('classifies declaration-only as statement-block', () => {
    expect(classifyExpressionSource('const a = 1')).toBe('statement-block');
  });
});

describe('expressionSourceFromProgram', () => {
  it('slices expression text from trimmed source', () => {
    const trimmed = '$json.a + 1';
    const program = parseExpressionProgram(trimmed);
    expect(expressionSourceFromProgram(trimmed, program)).toBe('$json.a + 1');
  });
});

describe('hasReturnStatement', () => {
  it('detects return in block', () => {
    const program = parseExpressionProgram('const a = 1; return a');
    expect(hasReturnStatement(program)).toBe(true);
  });

  it('returns false without return', () => {
    const program = parseExpressionProgram('const a = 1');
    expect(hasReturnStatement(program)).toBe(false);
  });
});
