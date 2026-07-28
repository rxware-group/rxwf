import * as acorn from 'acorn';
import { ancestor } from 'acorn-walk';
import {
  classifyExpressionSource,
  hasReturnStatement,
  parseExpressionProgram,
} from './js-sandbox/classify-expression-source.js';
import { wrapExpressionSource } from './js-sandbox/evaluate-js.js';

const FORBIDDEN_IDENTIFIERS = new Set([
  'process',
  'globalThis',
  'require',
  'eval',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'queueMicrotask',
  'Function',
]);

export type ValidateExpressionSourceResult =
  | { ok: true }
  | { ok: false; message: string };

type AcornProperty = acorn.Node & { computed: boolean; key: acorn.Node };
type AcornMemberExpression = acorn.Node & {
  computed: boolean;
  property: acorn.Node;
};
type AcornBindingPattern = acorn.Node & { id: acorn.Node | null };

function forbiddenReferenceMessage(name: string): string {
  return `Expression contains forbidden syntax: Forbidden identifier: ${name}`;
}

function isForbiddenIdentifierReference(
  node: acorn.Identifier,
  ancestors: acorn.Node[],
): boolean {
  if (!FORBIDDEN_IDENTIFIERS.has(node.name)) {
    return false;
  }

  const parent = ancestors[ancestors.length - 2];
  if (!parent) {
    return true;
  }

  if (parent.type === 'Property') {
    const prop = parent as AcornProperty;
    if (!prop.computed && prop.key === node) {
      return false;
    }
  }

  if (parent.type === 'MemberExpression') {
    const member = parent as AcornMemberExpression;
    if (!member.computed && member.property === node) {
      return false;
    }
  }

  if (
    (parent.type === 'VariableDeclarator' &&
      (parent as AcornBindingPattern).id === node) ||
    (parent.type === 'FunctionDeclaration' &&
      (parent as AcornBindingPattern).id === node) ||
    (parent.type === 'FunctionExpression' &&
      (parent as AcornBindingPattern).id === node) ||
    (parent.type === 'ClassDeclaration' &&
      (parent as AcornBindingPattern).id === node)
  ) {
    return true;
  }

  return true;
}

function validateAst(ast: acorn.Program): ValidateExpressionSourceResult {
  let violation: string | undefined;

  ancestor(ast, {
    ImportDeclaration() {
      violation ??= 'Expression contains forbidden syntax: Import declarations are not allowed';
    },
    ImportExpression() {
      violation ??= 'Expression contains forbidden syntax: Dynamic import is not allowed';
    },
    CallExpression(node) {
      if (violation) return;
      if (node.callee.type === 'Identifier') {
        const name = node.callee.name;
        if (name === 'eval' || name === 'Function') {
          violation = `Expression contains forbidden syntax: Forbidden call: ${name}`;
        } else if (FORBIDDEN_IDENTIFIERS.has(name)) {
          violation = forbiddenReferenceMessage(name);
        }
      }
    },
    NewExpression(node) {
      if (violation) return;
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Function'
      ) {
        violation = 'Expression contains forbidden syntax: Forbidden call: Function';
      }
    },
    Identifier(node, _state, ancestors) {
      if (violation) return;
      if (isForbiddenIdentifierReference(node, ancestors)) {
        violation = forbiddenReferenceMessage(node.name);
      }
    },
  });

  if (violation) {
    return { ok: false, message: violation };
  }
  return { ok: true };
}

export function validateExpressionSource(
  source: string,
): ValidateExpressionSourceResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, message: 'Expression source is empty' };
  }

  const kind = classifyExpressionSource(trimmed);
  if (kind === 'statement-block' && !/^\s*return\b/.test(trimmed)) {
    try {
      const program = parseExpressionProgram(trimmed);
      if (!hasReturnStatement(program)) {
        return {
          ok: false,
          message: 'Multi-statement expressions must include return',
        };
      }
    } catch {
      // fall through to wrapped parse
    }
  }

  let ast: acorn.Program;
  try {
    ast = acorn.parse(wrapExpressionSource(trimmed), {
      ecmaVersion: 2022,
      sourceType: 'script',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Invalid expression syntax: ${message}` };
  }

  return validateAst(ast);
}
