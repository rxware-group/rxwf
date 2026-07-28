import {
  isExpressionTemplate,
  normalizeExpressionTemplate,
} from '@rxwf/expression';

type N8nConditionRow = {
  left?: string;
  operator?: string;
  right?: unknown;
};

/** Resolve IF condition from AWF `condition` or n8n `conditions[]`. */
export function resolveIfConditionTemplate(
  config: Record<string, unknown>,
): string {
  const direct = String(config.condition ?? '').trim();
  if (direct) {
    return normalizeExpressionTemplate(direct);
  }

  const rows = config.conditions;
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  const first = rows[0] as N8nConditionRow;
  const left = String(first.left ?? '').trim();
  if (left) {
    return normalizeExpressionTemplate(left);
  }

  return '';
}

export function ifConditionIsExpression(config: Record<string, unknown>): boolean {
  const template = resolveIfConditionTemplate(config);
  return Boolean(template && isExpressionTemplate(template));
}
