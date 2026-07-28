import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import { encodeBinaryBuffer } from '@rxwf/shared';

export interface ParseWebhookBodyInput {
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

function parseMultipartWebhookBody(rawBody: Buffer, contentType: string): WorkflowItem[] {
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

function parseJsonWebhookBody(rawBody: Buffer): WorkflowItem[] {
  if (!rawBody.length) {
    return [{ json: {} }];
  }
  const parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return [{ json: parsed as Record<string, unknown> }];
  }
  return [{ json: { body: parsed } }];
}

export function parseWebhookBody(input: ParseWebhookBodyInput): WorkflowItem[] {
  const contentType = baseContentType(input.contentType);
  if (!input.rawBody.length) {
    return [{ json: {} }];
  }

  if (contentType === 'application/json' || contentType.endsWith('+json')) {
    return parseJsonWebhookBody(input.rawBody);
  }

  if (contentType === 'multipart/form-data') {
    return parseMultipartWebhookBody(input.rawBody, input.contentType);
  }

  if (
    contentType === 'application/octet-stream' ||
    contentType === 'application/binary'
  ) {
    return [
      {
        json: {},
        binary: {
          data: encodeBinaryBuffer(
            input.rawBody,
            contentType || 'application/octet-stream',
          ),
        },
      },
    ];
  }

  return [
    {
      json: { contentType: input.contentType },
      binary: {
        data: encodeBinaryBuffer(
          input.rawBody,
          contentType || 'application/octet-stream',
        ),
      },
    },
  ];
}
