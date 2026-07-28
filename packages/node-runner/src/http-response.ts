import type { BinaryAttachment } from '@rxwf/shared';
import { encodeBinaryBuffer } from '@rxwf/shared';

export interface HttpExecutionResult {
  ok: boolean;
  statusCode: number;
  statusMessage: string;
  requestUrl: string;
  responseUrl: string;
  redirected: boolean;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  body: unknown;
  responseBinary?: {
    propertyName: string;
    attachment: BinaryAttachment;
  };
}

export type HttpResponseBodyContentType = 'plaintext' | 'json' | 'html' | 'xml' | 'text';

export type HttpResponseBinaryMode = 'off' | 'auto' | 'always';

export const HTTP_RESPONSE_BODY_CONTENT_TYPES: HttpResponseBodyContentType[] = [
  'plaintext',
  'json',
  'html',
  'xml',
  'text',
];

export const HTTP_RESPONSE_BINARY_MODES: HttpResponseBinaryMode[] = [
  'off',
  'auto',
  'always',
];

export interface HttpNodeOutputOptions {
  outputResponseHeaders?: boolean;
  outputResponseBody?: boolean;
}

export interface ParseHttpResponseOptions {
  responseBodyContentType?: HttpResponseBodyContentType;
  responseBinaryMode?: HttpResponseBinaryMode;
  binaryPropertyName?: string;
}

export function readHttpOutputToggle(raw: unknown, defaultValue = true): boolean {
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  return defaultValue;
}

export function normalizeHttpResponseBodyContentType(raw: unknown): HttpResponseBodyContentType {
  const value = String(raw ?? 'json');
  if (value === 'javascript') return 'text';
  if (HTTP_RESPONSE_BODY_CONTENT_TYPES.includes(value as HttpResponseBodyContentType)) {
    return value as HttpResponseBodyContentType;
  }
  return 'json';
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

export function formatHttpResponseBodyText(
  text: string,
  contentType: HttpResponseBodyContentType,
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

export function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
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

function responseContentTypeHeader(response: Response): string {
  return response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
}

export async function parseHttpResponseBody(
  response: Response,
  options: ParseHttpResponseOptions = {},
): Promise<Pick<HttpExecutionResult, 'body' | 'responseBinary'>> {
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
  const fileName = parseContentDispositionFileName(
    response.headers.get('content-disposition'),
  );

  const useBinary =
    responseBinaryMode === 'always' ||
    (responseBinaryMode === 'auto' &&
      shouldAutoDetectBinaryResponse(contentTypeHeader));

  if (useBinary) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return { body: null };
    }
    const mimeType = contentTypeHeader || 'application/octet-stream';
    return {
      body: responseBinaryMode === 'always' ? null : undefined,
      responseBinary: {
        propertyName: binaryPropertyName,
        attachment: encodeBinaryBuffer(buffer, mimeType, { fileName }),
      },
    };
  }

  const text = await response.text();
  if (!text) return { body: null };

  const responseBodyContentType = options.responseBodyContentType;
  if (responseBodyContentType) {
    return { body: formatHttpResponseBodyText(text, responseBodyContentType) };
  }

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

export function buildHttpNodeOutputJson(
  result: HttpExecutionResult,
  error?: string,
  _options?: HttpNodeOutputOptions,
): Record<string, unknown> {
  const includeBody = result.responseBinary == null;
  return {
    ok: result.ok,
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
    url: result.requestUrl,
    requestUrl: result.requestUrl,
    responseUrl: result.responseUrl,
    redirected: result.redirected,
    headers: result.responseHeaders,
    ...(includeBody ? { body: result.body } : {}),
    request: {
      method: result.requestMethod,
      url: result.requestUrl,
      headers: result.requestHeaders,
    },
    ...(error ? { error } : {}),
  };
}
