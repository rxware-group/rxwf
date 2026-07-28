export type HttpBodyContentType =
  | 'none'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'raw'
  | 'binary'
  | 'binaryFromItem'
  | 'graphql';

export type HttpRawBodyContentType = 'text' | 'json' | 'javascript' | 'html' | 'xml';

export const HTTP_BODY_CONTENT_TYPES: HttpBodyContentType[] = [
  'none',
  'form-data',
  'x-www-form-urlencoded',
  'raw',
  'binary',
  'binaryFromItem',
  'graphql',
];

export const HTTP_RAW_BODY_CONTENT_TYPES: HttpRawBodyContentType[] = [
  'text',
  'json',
  'javascript',
  'html',
  'xml',
];

export function normalizeHttpBodyContentType(raw: unknown): HttpBodyContentType {
  const value = String(raw ?? 'none');
  if (value === 'json') return 'raw';
  if (HTTP_BODY_CONTENT_TYPES.includes(value as HttpBodyContentType)) {
    return value as HttpBodyContentType;
  }
  return 'none';
}

export function normalizeHttpRawBodyContentType(
  raw: unknown,
  legacyBodyContentType?: unknown,
): HttpRawBodyContentType {
  if (String(legacyBodyContentType ?? '') === 'json') return 'json';
  const value = String(raw ?? 'json');
  if (HTTP_RAW_BODY_CONTENT_TYPES.includes(value as HttpRawBodyContentType)) {
    return value as HttpRawBodyContentType;
  }
  return 'json';
}

export function rawBodyMimeType(rawContentType: HttpRawBodyContentType): string {
  switch (rawContentType) {
    case 'json':
      return 'application/json';
    case 'javascript':
      return 'application/javascript';
    case 'html':
      return 'text/html';
    case 'xml':
      return 'application/xml';
    default:
      return 'text/plain';
  }
}

export function buildGraphqlRequestBody(resolvedBody: string): string {
  try {
    JSON.parse(resolvedBody);
    return resolvedBody;
  } catch {
    return JSON.stringify({ query: resolvedBody });
  }
}
