import { describe, it, expect } from 'vitest';
import { validateExpressionSource } from './validate-expression-source.js';

describe('validateExpressionSource', () => {
  it('accepts safe expression', () => {
    expect(validateExpressionSource('return $json.x').ok).toBe(true);
  });

  it('accepts bare single expression without return keyword', () => {
    expect(validateExpressionSource('$json.x').ok).toBe(true);
  });

  it('rejects multi-statement without return', () => {
    const result = validateExpressionSource('const a = 1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/must include return/i);
    }
  });

  it('accepts multi-statement with return', () => {
    expect(validateExpressionSource('const a = 1; return a').ok).toBe(true);
  });

  it('rejects process call', () => {
    expect(validateExpressionSource('process.exit()').ok).toBe(false);
  });

  it('rejects dynamic import', () => {
    expect(validateExpressionSource('import("fs")').ok).toBe(false);
  });

  it('rejects fetch', () => {
    expect(validateExpressionSource('fetch("http://x")').ok).toBe(false);
  });

  it('allows forbidden words inside string literals', () => {
    expect(
      validateExpressionSource('return $json.msg === "process finished"').ok,
    ).toBe(true);
  });

  it('allows forbidden words as object literal keys', () => {
    expect(validateExpressionSource('return { process: 1 }').ok).toBe(true);
  });

  it('allows forbidden words as member property names', () => {
    expect(validateExpressionSource('return $json.process').ok).toBe(true);
  });

  it('rejects forbidden binding names', () => {
    expect(validateExpressionSource('const process = 1; return process').ok).toBe(
      false,
    );
  });

  it('rejects Function constructor', () => {
    expect(validateExpressionSource('Function("return 1")()').ok).toBe(false);
  });

  it('rejects invalid syntax', () => {
    const result = validateExpressionSource('return (');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Invalid expression syntax/);
    }
  });

  it('accepts async arrow in expression', () => {
    expect(
      validateExpressionSource('return (async () => 1)()').ok,
    ).toBe(true);
  });
});
