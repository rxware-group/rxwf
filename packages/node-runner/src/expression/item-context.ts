import type {
  ExpressionContext,
  NodeOutputEntry,
} from '@rxwf/expression';
import { resolveTemplateString } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';

export function expressionMetaFromNodeContext(
  ctx: Pick<
    NodeExecutionContext,
    | 'executionId'
    | 'executionMode'
    | 'executionEnvironment'
    | 'executionStartedAt'
    | 'workflowId'
    | 'workflowDefinition'
    | 'workflowVersionId'
  >,
): Pick<ExpressionContext, 'execution' | 'workflow'> {
  const execution =
    ctx.executionId != null
      ? {
          id: ctx.executionId,
          mode: ctx.executionMode ?? 'manual',
          environment: ctx.executionEnvironment ?? 'test',
          ...(ctx.executionStartedAt
            ? { startedAt: ctx.executionStartedAt }
            : {}),
        }
      : undefined;
  const workflow =
    ctx.workflowId != null
      ? {
          id: ctx.workflowId,
          name: ctx.workflowDefinition?.name ?? '',
          ...(ctx.workflowVersionId
            ? { versionId: ctx.workflowVersionId }
            : {}),
        }
      : undefined;
  return { execution, workflow };
}

export type ItemTemplateScope = Pick<
  NodeExecutionContext,
  | 'inputItems'
  | 'env'
  | 'nodes'
  | 'vars'
  | 'executionId'
  | 'executionMode'
  | 'executionEnvironment'
  | 'executionStartedAt'
  | 'workflowId'
  | 'workflowDefinition'
  | 'workflowVersionId'
>;

export function primaryItemJson(
  inputItems: WorkflowItem[],
  itemIndex = 0,
): Record<string, unknown> {
  return inputItems[itemIndex]?.json ?? inputItems[0]?.json ?? {};
}

export async function resolveInputItemTemplateString(
  value: string,
  scope: ItemTemplateScope,
  itemIndex = 0,
): Promise<string> {
  return resolveItemTemplateString(
    value,
    primaryItemJson(scope.inputItems, itemIndex),
    scope.inputItems,
    scope.env,
    scope.nodes,
    scope.vars,
    itemIndex,
    expressionMetaFromNodeContext(scope),
  );
}

export function itemExpressionContext(
  json: Record<string, unknown>,
  inputItems: WorkflowItem[],
  env?: Record<string, string>,
  nodes?: NodeOutputEntry[],
  vars?: Record<string, string>,
  itemIndex = 0,
  meta?: Pick<ExpressionContext, 'execution' | 'workflow'>,
): ExpressionContext {
  const item = inputItems[itemIndex] ?? inputItems[0];
  return {
    json,
    binary: item?.binary,
    input: inputItems,
    itemIndex,
    env,
    nodes,
    vars,
    ...meta,
  };
}

export async function resolveItemTemplateString(
  value: string,
  json: Record<string, unknown>,
  inputItems: WorkflowItem[],
  env?: Record<string, string>,
  nodes?: NodeOutputEntry[],
  vars?: Record<string, string>,
  itemIndex = 0,
  meta?: Pick<ExpressionContext, 'execution' | 'workflow'>,
): Promise<string> {
  return resolveTemplateString(
    value,
    itemExpressionContext(json, inputItems, env, nodes, vars, itemIndex, meta),
  );
}
