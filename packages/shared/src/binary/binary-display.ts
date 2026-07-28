import type { BinaryAttachment, BinaryMap } from '../item.js';
import { decodeBinaryData } from './binary-utils.js';

export function formatBinaryAttachmentForDisplay(
  attachment: BinaryAttachment,
): Record<string, unknown> {
  const fileSize =
    attachment.fileSize ??
    (attachment.data ? decodeBinaryData(attachment).length : 0);
  return {
    mimeType: attachment.mimeType,
    fileSize,
    ...(attachment.fileName ? { fileName: attachment.fileName } : {}),
    ...(attachment.ref ? { ref: attachment.ref } : {}),
  };
}

export function formatBinaryMapForDisplay(
  binary: BinaryMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, attachment] of Object.entries(binary)) {
    out[key] = formatBinaryAttachmentForDisplay(attachment);
  }
  return out;
}
