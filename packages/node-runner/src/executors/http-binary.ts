import type { BinaryAttachment, WorkflowItem } from '@rxwf/shared';
import { encodeBinaryBuffer, mergeBinaryMaps } from '@rxwf/shared';

export type HttpResponseBinaryMode = 'off' | 'auto' | 'always';

export const HTTP_RESPONSE_BINARY_MODES: HttpResponseBinaryMode[] = [
  'off',
  'auto',
  'always',
];

export interface HttpResponseBinaryOutput {
  propertyName: string;
  attachment: BinaryAttachment;
}

export interface ProduceHttpResponseBinaryOptions {
  responseBinaryMode?: HttpResponseBinaryMode;
  binaryPropertyName?: string;
  responseBodyContentType?: 'plaintext' | 'json' | 'html' | 'xml' | 'text';
}

export interface BuildHttpResponseBinaryOptions {
  mode: HttpResponseBinaryMode;
  binaryPropertyName: string;
  contentTypeHeader: string;
  contentDisposition?: string | null;
}

export function normalizeHttpResponseBinaryMode(raw: unknown): HttpResponseBinaryMode {
  const value = String(raw ?? 'off');
  if (HTTP_RESPONSE_BINARY_MODES.includes(value as HttpResponseBinaryMode)) {
    return value as HttpResponseBinaryMode;
  }
  return 'off';
}

export function normalizeHttpBinaryPropertyName(raw: unknown): string {
  const value = String(raw ?? 'data').trim();
  return value || 'data';
}

export function parseContentDispositionFileName(
  headerValue: string | null,
): string | undefined {
  if (!headerValue) return undefined;
  const quoted = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(
    headerValue,
  );
  const raw = quoted?.[1] ?? quoted?.[2] ?? quoted?.[3];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

export function shouldAutoDetectBinaryResponse(contentType: string): boolean {
  const ct = contentType.trim().toLowerCase();
  if (!ct) return true;
  if (ct.includes('json') || ct.endsWith('+json')) return false;
  if (ct.startsWith('text/')) return false;
  if (ct.includes('xml') || ct.includes('html') || ct.includes('javascript')) {
    return false;
  }
  if (ct.includes('x-www-form-urlencoded')) return false;
  return true;
}

export function shouldUseBinaryResponseMode(
  mode: HttpResponseBinaryMode,
  contentTypeHeader: string,
): boolean {
  return (
    mode === 'always' ||
    (mode === 'auto' && shouldAutoDetectBinaryResponse(contentTypeHeader))
  );
}

function responseContentTypeHeader(response: Response): string {
  return response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function buildHttpResponseBinaryFromBuffer(
  buffer: Buffer,
  options: BuildHttpResponseBinaryOptions,
): { body: unknown; responseBinary?: HttpResponseBinaryOutput } {
  if (!buffer.length) {
    return { body: null };
  }
  const mimeType = options.contentTypeHeader || 'application/octet-stream';
  const fileName = parseContentDispositionFileName(options.contentDisposition ?? null);
  return {
    body: options.mode === 'always' ? null : undefined,
    responseBinary: {
      propertyName: options.binaryPropertyName,
      attachment: encodeBinaryBuffer(buffer, mimeType, { fileName }),
    },
  };
}

function formatHttpResponseBodyText(
  text: string,
  contentType: NonNullable<ProduceHttpResponseBinaryOptions['responseBodyContentType']>,
): unknown {
  if (!text) return null;
  if (contentType === 'json') {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

async function parseHttpResponseTextBody(
  response: Response,
  options: ProduceHttpResponseBinaryOptions,
): Promise<{ body: unknown }> {
  const text = await response.text();
  if (!text) return { body: null };

  const responseBodyContentType = options.responseBodyContentType;
  if (responseBodyContentType) {
    return { body: formatHttpResponseBodyText(text, responseBodyContentType) };
  }

  const contentTypeHeader = responseContentTypeHeader(response);
  if (contentTypeHeader.includes('json') || contentTypeHeader.endsWith('+json')) {
    try {
      return { body: JSON.parse(text) as unknown };
    } catch {
      return { body: text };
    }
  }

  if (
    contentTypeHeader.startsWith('text/') ||
    contentTypeHeader.includes('xml') ||
    contentTypeHeader.includes('javascript') ||
    contentTypeHeader.includes('html')
  ) {
    return { body: text };
  }

  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { body: text };
  }
}

export async function produceHttpResponseBinaryFromResponse(
  response: Response,
  options: ProduceHttpResponseBinaryOptions = {},
): Promise<{ body: unknown; responseBinary?: HttpResponseBinaryOutput }> {
  if (response.status === 204 || response.status === 205) {
    return { body: null };
  }

  const responseBinaryMode = normalizeHttpResponseBinaryMode(
    options.responseBinaryMode,
  );
  const binaryPropertyName = normalizeHttpBinaryPropertyName(
    options.binaryPropertyName,
  );
  const contentTypeHeader = responseContentTypeHeader(response);

  if (shouldUseBinaryResponseMode(responseBinaryMode, contentTypeHeader)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buildHttpResponseBinaryFromBuffer(buffer, {
      mode: responseBinaryMode,
      binaryPropertyName,
      contentTypeHeader,
      contentDisposition: response.headers.get('content-disposition'),
    });
  }

  return parseHttpResponseTextBody(response, options);
}

export function applyHttpResponseBinaryToItem(
  item: WorkflowItem,
  responseBinary: HttpResponseBinaryOutput,
): WorkflowItem {
  return {
    ...item,
    binary: mergeBinaryMaps(item.binary, {
      [responseBinary.propertyName]: responseBinary.attachment,
    }),
  };
}
