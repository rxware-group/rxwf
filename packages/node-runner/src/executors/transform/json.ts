import { hasTemplateSyntax, resolveTemplateJson } from '@rxwf/expression';
import { AwfError, withJsonPreservingBinary } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';
import { withItemExpressionSession } from '../../expression/expression-session.js';

function readJsonExpression(config: Record<string, unknown>): string {
  const expression = config.expression;
  if (typeof expression === 'string' && expression.trim()) {
    return expression.trim();
  }
  if (config.data !== undefined) {
    return JSON.stringify(config.data);
  }
  return '{}';
}

function parseFixedJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed ?? null };
  } catch {
    throw new AwfError('E1002', 'Invalid JSON expression');
  }
}

export const jsonExecutor: NodeExecutor = {
  type: 'json',
  async execute(ctx) {
    const raw = readJsonExpression(ctx.config);
    const needsTemplate = hasTemplateSyntax(raw);
    const output = await Promise.all(
      ctx.inputItems.map(async (item, itemIndex) => {
        if (!needsTemplate) {
          return withJsonPreservingBinary(item, parseFixedJson(raw));
        }
        const json = await withItemExpressionSession(ctx, item, itemIndex, (session) =>
          resolveTemplateJson(raw, session.frozenContext, session),
        );
        return withJsonPreservingBinary(item, json);
      }),
    );
    return { status: 'success', outputItems: [output] };
  },
};
