import * as acorn from 'acorn';
import { ancestor } from 'acorn-walk';

export type ExpressionSourceKind = 'expression' | 'statement-block';

export function classifyExpressionSource(source: string): ExpressionSourceKind {
  const trimmed = source.trim();
  if (!trimmed) {
    return 'statement-block';
  }
  if (/^\s*return\b/.test(trimmed)) {
    return 'statement-block';
  }
  let program: acorn.Program;
  try {
    program = parseExpressionProgram(trimmed);
  } catch {
    return 'statement-block';
  }
  if (
    program.body.length === 1 &&
    program.body[0]!.type === 'ExpressionStatement'
  ) {
    return 'expression';
  }
  return 'statement-block';
}

export function parseExpressionProgram(source: string): acorn.Program {
  const trimmed = source.trim();
  for (const sourceType of ['module', 'script'] as const) {
    try {
      return acorn.parse(trimmed, { ecmaVersion: 2022, sourceType });
    } catch {
      // try next
    }
  }
  return acorn.parse(
    `async function __exprParse() { ${trimmed} }`,
    { ecmaVersion: 2022, sourceType: 'script' },
  );
}

export function expressionSourceFromProgram(
  trimmed: string,
  program: acorn.Program,
): string {
  const stmt = program.body[0];
  if (stmt?.type !== 'ExpressionStatement') {
    throw new Error('Program is not a single ExpressionStatement');
  }
  const { start, end } = stmt.expression;
  if (start == null || end == null) {
    throw new Error('Expression node missing position');
  }
  return trimmed.slice(start, end);
}

export function hasReturnStatement(program: acorn.Program): boolean {
  let found = false;
  ancestor(program, {
    ReturnStatement() {
      found = true;
    },
  });
  return found;
}
