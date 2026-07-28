import { resolveItemTemplateString } from '../../expression/item-context.js';
import type { NodeExecutionContext, NodeExecutor, NodeRunResult } from '../../types/node-executor.js';

function parseConfigFlag(value: unknown, defaultWhenEmpty: boolean): boolean {
  if (value === undefined || value === null || value === '') return defaultWhenEmpty;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseRejectFlag(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() !== 'false';
}

async function buildSummary(ctx: NodeExecutionContext): Promise<string> {
  const field = String(ctx.config.summaryField ?? '').trim();
  if (!field) {
    if (ctx.inputItems.length === 0) return '';
    return JSON.stringify(ctx.inputItems.map((i) => i.json));
  }
  return resolveItemTemplateString(
    field.startsWith('{{') ? field : `{{ ${field} }}`,
    ctx.inputItems[0]?.json ?? {},
    ctx.inputItems,
    ctx.env,
    ctx.nodes,
    ctx.vars,
  );
}

export const humanApprovalExecutor: NodeExecutor = {
  type: 'humanApproval',
  async execute(ctx): Promise<NodeRunResult> {
    const promptRaw = String(ctx.config.prompt ?? '请审批后继续执行');
    const prompt = await resolveItemTemplateString(
      promptRaw,
      ctx.inputItems[0]?.json ?? {},
      ctx.inputItems,
      ctx.env,
      ctx.nodes,
      ctx.vars,
    );
    const summary = await buildSummary(ctx);
    const timeoutMs = Number(ctx.config.timeoutMs ?? 0);
    const timeoutAction =
      String(ctx.config.timeoutAction ?? 'reject').trim() === 'approve'
        ? 'approve'
        : 'reject';
    const requestedAt = new Date();
    const expiresAt =
      timeoutMs > 0
        ? new Date(requestedAt.getTime() + timeoutMs).toISOString()
        : undefined;

    return {
      status: 'waiting',
      metadata: {
        hitl: {
          prompt,
          summary,
          allowReject: parseRejectFlag(ctx.config.allowReject),
          allowSupplement: parseConfigFlag(ctx.config.allowSupplement, false),
          timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
          timeoutAction: timeoutMs > 0 ? timeoutAction : undefined,
          requestedAt: requestedAt.toISOString(),
          expiresAt,
        },
      },
    };
  },
};
