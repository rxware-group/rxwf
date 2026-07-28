import { AwfError } from '@rxwf/shared';
import { evaluateExpression } from './evaluate.js';
import { evaluateJsExpression } from './js-sandbox/evaluate-js.js';
import type { ExpressionEvaluator } from './js-sandbox/expression-evaluator.js';
import {
  hasTemplateSyntax,
  isExpressionTemplate,
  normalizeExpressionTemplate,
} from './template-syntax.js';
import { toDisplayString } from './to-display-string.js';
import type { ExpressionContext } from './types.js';

export { hasTemplateSyntax } from './template-syntax.js';

const EMBEDDED_TEMPLATE_RE = /\{\{\s*([\s\S]+?)\s*\}\}/g;

/** Resolve a string that may be a full or embedded {{ }} / ={{ }} template. */
export async function resolveTemplateString(
  value: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<string> {
  const trimmed = value.trim();
  if (!hasTemplateSyntax(trimmed)) {
    return value;
  }

  const normalized = normalizeExpressionTemplate(trimmed);
  if (isExpressionTemplate(normalized)) {
    const result = await evaluateExpression(normalized, context, session);
    return toDisplayString(result);
  }

  EMBEDDED_TEMPLATE_RE.lastIndex = 0;
  const matches = [...value.matchAll(EMBEDDED_TEMPLATE_RE)];
  if (matches.length === 0) {
    return value;
  }

  const inners = matches.map((m) => m[1]!.trim());
  const evaluated = session
    ? await session.evaluateBatch(inners)
    : await Promise.all(inners.map((inner) => evaluateJsExpression(inner, context)));

  let out = value;
  matches.forEach((match, index) => {
    out = out.replace(match[0], () => toDisplayString(evaluated[index]));
  });
  return out;
}

const N8N_FULL_TEMPLATE_RE = /^=\{\{\s*[\s\S]+\s*\}\}$/;

export async function resolveTemplateValue(
  value: unknown,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (N8N_FULL_TEMPLATE_RE.test(trimmed)) {
      return evaluateExpression(normalizeExpressionTemplate(trimmed), context, session);
    }
    return hasTemplateSyntax(value)
      ? resolveTemplateString(value, context, session)
      : value;
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((entry) => resolveTemplateValue(entry, context, session)),
    );
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = await resolveTemplateValue(entry, context, session);
    }
    return out;
  }
  return value;
}

/** Evaluate a template or JSON-with-templates into a JSON object. */
export async function resolveTemplateJson(
  raw: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<Record<string, unknown>> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const normalized = normalizeExpressionTemplate(trimmed);
  if (isExpressionTemplate(normalized)) {
    return expressionResultToJson(
      await evaluateExpression(normalized, context, session),
    );
  }

  if (!hasTemplateSyntax(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return expressionResultToJson(parsed);
    } catch {
      throw new AwfError('E1002', 'Invalid JSON expression');
    }
  }

  const resolved = await resolveTemplateString(trimmed, context, session);
  try {
    const parsed = JSON.parse(resolved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return expressionResultToJson(parsed);
  } catch {
    throw new AwfError('E1002', 'Expression did not resolve to valid JSON');
  }
}

export function expressionResultToJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value: value ?? null };
}
