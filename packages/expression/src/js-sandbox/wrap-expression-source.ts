import {
  classifyExpressionSource,
  expressionSourceFromProgram,
  parseExpressionProgram,
} from './classify-expression-source.js';

/** Wrap user source as an async IIFE executed by the isolate. */
export function wrapExpressionSource(source: string): string {
  const trimmed = source.trim();
  if (classifyExpressionSource(trimmed) === 'expression') {
    const program = parseExpressionProgram(trimmed);
    const expr = expressionSourceFromProgram(trimmed, program);
    return `(async () => { 'use strict'; return ${expr}; })()`;
  }
  return `(async () => { 'use strict'; ${trimmed} })()`;
}
