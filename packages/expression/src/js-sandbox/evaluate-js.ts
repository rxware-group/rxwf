import type { ExpressionContext } from '../types.js';
import type { ExpressionEvaluator } from './expression-evaluator.js';
import { evaluateViaPool } from './expression-pool.js';

export { wrapExpressionSource } from './wrap-expression-source.js';

/**
 * Evaluate JavaScript expression source in isolated-vm (pooled worker by default).
 * Pass an open ExpressionEvaluator session to reuse bootstrap within a batch.
 */
export async function evaluateJsExpression(
  source: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<unknown> {
  if (session) {
    return session.evaluate(source);
  }
  return evaluateViaPool(source, context);
}
