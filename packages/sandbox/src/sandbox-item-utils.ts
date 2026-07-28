import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import { isBinaryAttachment } from '@rxwf/shared';

export function sanitizeBinaryMap(value: unknown): BinaryMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out: BinaryMap = {};
  for (const [key, attachment] of Object.entries(value as Record<string, unknown>)) {
    if (isBinaryAttachment(attachment)) {
      out[key] = attachment;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeSandboxReturnItem(raw: unknown): WorkflowItem {
  if (raw === null || raw === undefined) {
    return { json: {} };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { json: { value: raw } };
  }
  if ('json' in raw) {
    const candidate = raw as { json?: unknown; binary?: unknown };
    const json =
      candidate.json && typeof candidate.json === 'object' && !Array.isArray(candidate.json)
        ? (candidate.json as Record<string, unknown>)
        : {};
    const item: WorkflowItem = { json };
    const binary = sanitizeBinaryMap(candidate.binary);
    if (binary) {
      item.binary = binary;
    }
    return item;
  }
  return { json: raw as Record<string, unknown> };
}

export function normalizeSandboxReturnValue(raw: unknown): WorkflowItem[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeSandboxReturnItem);
  }
  return [normalizeSandboxReturnItem(raw)];
}
