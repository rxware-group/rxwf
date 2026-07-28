import type { BinaryAttachment, BinaryMap, WorkflowItem } from '../item.js';

export const DEFAULT_BINARY_INLINE_MAX_BYTES = 256 * 1024;
export const DEFAULT_BINARY_ITEM_MAX_BYTES = 32 * 1024 * 1024;

export function isBinaryAttachment(value: unknown): value is BinaryAttachment {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as BinaryAttachment).data === 'string' &&
    typeof (value as BinaryAttachment).mimeType === 'string'
  );
}

export function isBinaryMap(value: unknown): value is BinaryMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isBinaryAttachment);
}

export function decodeBinaryData(attachment: BinaryAttachment): Buffer {
  if (!attachment.data) return Buffer.alloc(0);
  return Buffer.from(attachment.data, 'base64');
}

export function encodeBinaryBuffer(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  opts?: { fileName?: string },
): BinaryAttachment {
  const buf = Buffer.from(buffer);
  return {
    data: buf.toString('base64'),
    mimeType,
    fileSize: buf.length,
    ...(opts?.fileName ? { fileName: opts.fileName } : {}),
  };
}

/** Keep item.binary when replacing json (transform nodes). */
export function withJsonPreservingBinary(
  item: WorkflowItem,
  json: Record<string, unknown>,
): WorkflowItem {
  const out: WorkflowItem = { json };
  if (item.binary && Object.keys(item.binary).length > 0) {
    out.binary = item.binary;
  }
  return out;
}

export function mergeBinaryMaps(
  base: BinaryMap | undefined,
  extra: BinaryMap | undefined,
): BinaryMap | undefined {
  if (!base && !extra) return undefined;
  return { ...(base ?? {}), ...(extra ?? {}) };
}

export function totalBinaryBytes(binary: BinaryMap | undefined): number {
  if (!binary) return 0;
  let total = 0;
  for (const att of Object.values(binary)) {
    total += att.fileSize ?? decodeBinaryData(att).length;
  }
  return total;
}
