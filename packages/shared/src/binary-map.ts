export type BinaryBlobRef = {
  blobId: string;
};

export type BinaryAttachment = {
  /** base64 inline data; empty when externalized to blob */
  data: string;
  mimeType: string;
  fileName?: string;
  /** Decoded byte length */
  fileSize?: number;
  ref?: BinaryBlobRef;
};

export type BinaryMap = Record<string, BinaryAttachment>;

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

export function mergeBinaryMaps(
  base: BinaryMap | undefined,
  extra: BinaryMap | undefined,
): BinaryMap | undefined {
  if (!base && !extra) return undefined;
  return { ...(base ?? {}), ...(extra ?? {}) };
}
