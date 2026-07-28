import {
  evaluateExpression,
  normalizeExpressionTemplate,
  resolveTemplateValue,
} from '@rxwf/expression';
import type { ExpressionContext } from '@rxwf/expression';
import { mergeBinaryMaps, type WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';
import {
  expressionMetaFromNodeContext,
  itemExpressionContext,
} from '../../expression/item-context.js';
import { splitResolvedSetFields } from './set-binary.js';

const N8N_FULL_EXPRESSION_RE = /^=\{\{\s*[\s\S]+\s*\}\}$/;

async function resolveSetExpressionFields(
  fields: Record<string, unknown>,
  context: ExpressionContext,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && N8N_FULL_EXPRESSION_RE.test(value.trim())) {
      out[key] = await evaluateExpression(
        normalizeExpressionTemplate(value.trim()),
        context,
      );
      continue;
    }
    out[key] = await resolveTemplateValue(value, context);
  }
  return out;
}

function resolveSetFields(config: Record<string, unknown>): Record<string, unknown> {
  const fields = config.fields;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    return fields as Record<string, unknown>;
  }
  const values = config.values;
  if (!Array.isArray(values)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const row of values) {
    if (!row || typeof row !== 'object') continue;
    const name = (row as { name?: string }).name;
    if (!name) continue;
    out[name] = (row as { value?: unknown }).value;
  }
  return out;
}

function isExpressionMode(config: Record<string, unknown>): boolean {
  return String(config.mode ?? 'manual') === 'expression';
}

function applySetToItem(
  item: WorkflowItem,
  resolved: Record<string, unknown>,
): WorkflowItem {
  const { json: jsonPatch, binary: binaryPatch } = splitResolvedSetFields(resolved);
  const out: WorkflowItem = {
    json: { ...item.json, ...jsonPatch },
  };
  const mergedBinary = mergeBinaryMaps(item.binary, binaryPatch);
  if (mergedBinary && Object.keys(mergedBinary).length > 0) {
    out.binary = mergedBinary;
  }
  return out;
}

export const setExecutor: NodeExecutor = {
  type: 'set',
  async execute(ctx) {
    const expressionMode = isExpressionMode(ctx.config);
    const fields = resolveSetFields(ctx.config);
    const output = await Promise.all(
      ctx.inputItems.map(async (item, itemIndex) => {
        const exprCtx = itemExpressionContext(
          item.json,
          ctx.inputItems,
          ctx.env,
          ctx.nodes,
          ctx.vars,
          itemIndex,
          expressionMetaFromNodeContext(ctx),
        );
        const resolved = expressionMode
          ? await resolveSetExpressionFields(fields, exprCtx)
          : fields;
        return applySetToItem(item, resolved);
      }),
    );
    return { status: 'success', outputItems: [output] };
  },
};

export { resolveSetFields, isExpressionMode };
