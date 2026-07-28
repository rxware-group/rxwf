import { AwfError, type WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';

/** Build output items from Manual Trigger `json` parameter (object or array of objects). */
export function parseManualTriggerOutput(config: Record<string, unknown>): WorkflowItem[] {
  let raw: unknown = config.json ?? {};

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [{ json: {} }];
    try {
      raw = JSON.parse(trimmed) as unknown;
    } catch {
      throw new AwfError('E1002', 'Invalid JSON in Manual Trigger output');
    }
  }

  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === 'object' && entry !== null && 'json' in entry) {
        return entry as WorkflowItem;
      }
      return { json: (entry ?? {}) as Record<string, unknown> };
    });
  }

  if (typeof raw === 'object' && raw !== null) {
    return [{ json: raw as Record<string, unknown> }];
  }

  return [{ json: {} }];
}

export const manualTriggerExecutor: NodeExecutor = {
  type: 'manualTrigger',
  async execute(ctx) {
    const items = parseManualTriggerOutput(ctx.config);
    return {
      status: 'success',
      outputItems: [items],
    };
  },
};
