import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import { encodeBinaryBuffer } from '@rxwf/shared';

export interface WebhookBinaryBodyInput {
  rawBody: Buffer;
  contentType: string;
}

function baseContentType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function parseBoundary(contentType: string): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2];
}

function parseContentDisposition(header: string): {
  name?: string;
  fileName?: string;
  mimeType?: string;
} {
  const nameMatch = /name="([^"]+)"/i.exec(header);
  const fileNameMatch = /filename="([^"]+)"/i.exec(header);
  const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(header);
  return {
    name: nameMatch?.[1],
    fileName: fileNameMatch?.[1],
    mimeType: mimeMatch?.[1]?.trim(),
  };
}

/** CONF-05: multipart file fields → binary[fieldName]; text fields → json. */
export function parseWebhookMultipartBody(
  rawBody: Buffer,
  contentType: string,
): WorkflowItem[] {
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    return [{ json: {} }];
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const json: Record<string, unknown> = {};
  const binary: BinaryMap = {};
  let offset = 0;

  while (offset < rawBody.length) {
    const start = rawBody.indexOf(delimiter, offset);
    if (start === -1) break;
    offset = start + delimiter.length;
    if (rawBody[offset] === 0x2d && rawBody[offset + 1] === 0x2d) break;
    if (rawBody[offset] === 0x0d && rawBody[offset + 1] === 0x0a) {
      offset += 2;
    }

    const partEnd = rawBody.indexOf(delimiter, offset);
    if (partEnd === -1) break;
    let part = rawBody.subarray(offset, partEnd);
    if (part.length >= 2 && part[part.length - 2] === 0x0d && part[part.length - 1] === 0x0a) {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      offset = partEnd;
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString('utf8');
    const body = part.subarray(headerEnd + 4);
    const disposition = parseContentDisposition(headerText);
    const fieldName = disposition.name;
    if (!fieldName) {
      offset = partEnd;
      continue;
    }

    const isFile =
      /filename=/i.test(headerText) ||
      disposition.mimeType?.startsWith('application/') === true ||
      disposition.fileName != null;

    if (isFile) {
      binary[fieldName] = encodeBinaryBuffer(
        body,
        disposition.mimeType || 'application/octet-stream',
        { fileName: disposition.fileName },
      );
    } else {
      json[fieldName] = body.toString('utf8');
    }

    offset = partEnd;
  }

  const item: WorkflowItem = { json };
  if (Object.keys(binary).length > 0) {
    item.binary = binary;
  }
  return [item];
}

export function webhookBinaryItemsFromBody(input: WebhookBinaryBodyInput): WorkflowItem[] {
  const contentType = baseContentType(input.contentType);
  if (!input.rawBody.length) {
    return [{ json: {} }];
  }
  if (contentType === 'multipart/form-data') {
    return parseWebhookMultipartBody(input.rawBody, input.contentType);
  }
  return [{ json: {} }];
}
