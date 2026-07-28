import { evaluateCondition } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext, NodeExecutor } from '../../types/node-executor.js';
import {
  expressionMetaFromNodeContext,
  itemExpressionContext,
} from '../../expression/item-context.js';
import {
  ifConditionIsExpression,
  resolveIfConditionTemplate,
} from './if-condition.js';

async function matchesItem(
  config: Record<string, unknown>,
  json: Record<string, unknown>,
  inputItems: WorkflowItem[],
  itemIndex: number,
  ctx: Pick<
    NodeExecutionContext,
    | 'env'
    | 'vars'
    | 'nodes'
    | 'executionId'
    | 'executionMode'
    | 'executionEnvironment'
    | 'executionStartedAt'
    | 'workflowId'
    | 'workflowDefinition'
    | 'workflowVersionId'
  >,
): Promise<boolean> {
  const { env, vars, nodes } = ctx;
  if (ifConditionIsExpression(config)) {
    const template = resolveIfConditionTemplate(config);
    return evaluateCondition(
      template,
      itemExpressionContext(
        json,
        inputItems,
        env,
        nodes,
        vars,
        itemIndex,
        expressionMetaFromNodeContext(ctx),
      ),
    );
  }

  const field = String(config.field ?? '');
  if (field) {
    return json[field] === config.expected;
  }

  return Boolean(config.expected);
}

export const ifExecutor: NodeExecutor = {
  type: 'if',
  async execute(ctx) {
    const legacyField = String(ctx.config.field ?? '').trim();
    const template = resolveIfConditionTemplate(ctx.config);
    const usesExpressionConfig =
      'condition' in ctx.config ||
      (Array.isArray(ctx.config.conditions) && ctx.config.conditions.length > 0);

    if (!legacyField && usesExpressionConfig && !template) {
      return {
        status: 'failed',
        errorCode: 'E2003',
        errorMessage: 'if requires a non-empty {{ }} condition expression',
      };
    }

    const trueBranch: typeof ctx.inputItems = [];
    const falseBranch: typeof ctx.inputItems = [];
    for (let itemIndex = 0; itemIndex < ctx.inputItems.length; itemIndex++) {
      const item = ctx.inputItems[itemIndex]!;
      if (
        await matchesItem(ctx.config, item.json, ctx.inputItems, itemIndex, ctx)
      ) {
        trueBranch.push(item);
      } else {
        falseBranch.push(item);
      }
    }
    return {
      status: 'success',
      outputItems: [trueBranch, falseBranch],
    };
  },
};
