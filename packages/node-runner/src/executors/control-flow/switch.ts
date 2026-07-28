import { evaluateCondition } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import { parseSwitchBranches } from '@rxwf/workflow';
import type { NodeExecutionContext, NodeExecutor } from '../../types/node-executor.js';
import { expressionMetaFromNodeContext } from '../../expression/item-context.js';
import { resolveIfConditionTemplate } from './if-condition.js';

async function branchMatches(
  condition: string,
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
  const template = resolveIfConditionTemplate({ condition });
  if (!template) return false;
  return evaluateCondition(template, {
    json,
    input: inputItems,
    itemIndex,
    env: ctx.env,
    nodes: ctx.nodes,
    vars: ctx.vars,
    ...expressionMetaFromNodeContext(ctx),
  });
}

export const switchExecutor: NodeExecutor = {
  type: 'switch',
  async execute(ctx) {
    const branches = parseSwitchBranches(ctx.config);
    if (branches.length === 0) {
      return {
        status: 'failed',
        errorCode: 'E2003',
        errorMessage: 'switch requires at least one branch',
      };
    }

    const outputItems: WorkflowItem[][] = branches.map(() => []);

    for (let itemIndex = 0; itemIndex < ctx.inputItems.length; itemIndex++) {
      const item = ctx.inputItems[itemIndex]!;
      let matched = false;
      for (let i = 0; i < branches.length; i++) {
        const branch = branches[i]!;
        if (
          await branchMatches(
            branch.condition,
            item.json,
            ctx.inputItems,
            itemIndex,
            ctx,
          )
        ) {
          outputItems[i]!.push(item);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // discard item when no branch matches
      }
    }

    return { status: 'success', outputItems };
  },
};
