import type { WorkflowItem } from '@rxwf/shared';

type BinaryEntry = { data: string; mimeType: string; fileName?: string };
type BinaryMap = Record<string, BinaryEntry>;

function isBinaryEntry(v: unknown): v is BinaryEntry {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as BinaryEntry).data === 'string' &&
    typeof (v as BinaryEntry).mimeType === 'string'
  );
}

function isBinaryMap(v: unknown): v is BinaryMap {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v).every(isBinaryEntry);
}

/** Stringify an expression result for embedded `{{ }}` segments in fixed-mode fields. */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isBinaryMap(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1) return `[binary:${keys[0]!}]`;
    return keys.map((k) => `[binary:${k}]`).join(',');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Type guard for WorkflowItem.binary-shaped maps. */
export function asBinaryMap(
  binary: WorkflowItem['binary'] | undefined,
): BinaryMap | undefined {
  if (!binary) return undefined;
  return binary;
}
