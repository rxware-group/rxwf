import { evaluateJsExpression } from './js-sandbox/evaluate-js.js';
import type { ExpressionEvaluator } from './js-sandbox/expression-evaluator.js';
import { unwrapTemplate } from './template-syntax.js';
import type { ExpressionContext } from './types.js';

export type {
  ExpressionContext,
  ExecutionMeta,
  WorkflowMeta,
} from './types.js';
export { evaluateJsExpression } from './js-sandbox/evaluate-js.js';

export async function evaluateExpression(
  template: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<unknown> {
  const inner = unwrapTemplate(template);
  return evaluateJsExpression(inner, context, session);
}

/** Evaluate a condition template to boolean (for IF / filters). */
export async function evaluateCondition(
  template: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<boolean> {
  return Boolean(await evaluateExpression(template, context, session));
}
