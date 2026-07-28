import { ExpressionEvaluator } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import { expressionMetaFromNodeContext, itemExpressionContext } from './item-context.js';

export async function withItemExpressionSession<T>(
  ctx: NodeExecutionContext,
  item: WorkflowItem,
  itemIndex: number,
  fn: (session: ExpressionEvaluator) => Promise<T>,
): Promise<T> {
  const exprCtx = itemExpressionContext(
    item.json,
    ctx.inputItems,
    ctx.env,
    ctx.nodes,
    ctx.vars,
    itemIndex,
    expressionMetaFromNodeContext(ctx),
  );
  const session = await ExpressionEvaluator.open(exprCtx);
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}
