import { hasTemplateSyntax, resolveTemplateString } from '@rxwf/expression';
import type { ExpressionContext, NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import { itemExpressionContext } from './item-context.js';
import type { ExpressionEvaluator } from '@rxwf/expression';

/** Resolve a string parameter: literals pass through; {{ }} segments are evaluated. */
export async function resolveConfigStringField(
  _config: Record<string, unknown>,
  _fieldKey: string,
  value: string,
  context: ExpressionContext,
  session?: ExpressionEvaluator,
): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed || !hasTemplateSyntax(trimmed)) {
    return value;
  }
  return resolveTemplateString(trimmed, context, session);
}

export async function resolveItemConfigStringField(
  config: Record<string, unknown>,
  fieldKey: string,
  value: string,
  json: Record<string, unknown>,
  inputItems: WorkflowItem[],
  env?: Record<string, string>,
  nodes?: NodeOutputEntry[],
  vars?: Record<string, string>,
  itemIndex = 0,
  meta?: Pick<ExpressionContext, 'execution' | 'workflow'>,
  session?: ExpressionEvaluator,
): Promise<string> {
  return resolveConfigStringField(
    config,
    fieldKey,
    value,
    itemExpressionContext(json, inputItems, env, nodes, vars, itemIndex, meta),
    session,
  );
}
