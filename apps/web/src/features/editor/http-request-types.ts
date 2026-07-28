export type HttpKeyValueRow = {
  enabled: boolean;
  key: string;
  value: string;
};

export type HttpBodyContentType =
  | 'none'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'raw'
  | 'binary'
  | 'binaryFromItem'
  | 'graphql';

export type HttpRawBodyContentType = 'text' | 'json' | 'javascript' | 'html' | 'xml';

export type HttpResponseBodyContentType = 'plaintext' | 'json' | 'html' | 'xml' | 'text';

export type HttpResponseBinaryMode = 'off' | 'auto' | 'always';

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
  'json',
  'text',
  'javascript',
  'html',
  'xml',
];

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

export function normalizeHttpResponseBinaryMode(raw: unknown): HttpResponseBinaryMode {
  const value = String(raw ?? 'off');
  if (HTTP_RESPONSE_BINARY_MODES.includes(value as HttpResponseBinaryMode)) {
    return value as HttpResponseBinaryMode;
  }
  return 'off';
}

export function normalizeHttpResponseBodyContentType(
  raw: unknown,
): HttpResponseBodyContentType {
  const value = String(raw ?? 'json');
  if (value === 'javascript') return 'text';
  if (HTTP_RESPONSE_BODY_CONTENT_TYPES.includes(value as HttpResponseBodyContentType)) {
    return value as HttpResponseBodyContentType;
  }
  return 'json';
}

export function readHttpOutputToggle(raw: unknown, defaultValue = true): boolean {
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  return defaultValue;
}

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

export function createEmptyHttpKeyValueRow(): HttpKeyValueRow {
  return { enabled: true, key: '', value: '' };
}

export function normalizeHttpKeyValueRows(raw: unknown): HttpKeyValueRow[] {
  if (!Array.isArray(raw)) return [createEmptyHttpKeyValueRow()];
  const rows = raw.map((item) => {
    if (!item || typeof item !== 'object') {
      return createEmptyHttpKeyValueRow();
    }
    const row = item as Record<string, unknown>;
    return {
      enabled: row.enabled !== false,
      key: String(row.key ?? ''),
      value: String(row.value ?? ''),
    };
  });
  return ensureTrailingEmptyRow(rows);
}

export function ensureTrailingEmptyRow(rows: HttpKeyValueRow[]): HttpKeyValueRow[] {
  if (rows.length === 0) return [createEmptyHttpKeyValueRow()];
  const last = rows[rows.length - 1]!;
  if (last.key.trim() || last.value.trim()) {
    return [...rows, createEmptyHttpKeyValueRow()];
  }
  return rows;
}

export function stripTrailingEmptyRows(rows: HttpKeyValueRow[]): HttpKeyValueRow[] {
  const copy = [...rows];
  while (copy.length > 1) {
    const last = copy[copy.length - 1]!;
    if (!last.key.trim() && !last.value.trim()) {
      copy.pop();
    } else {
      break;
    }
  }
  return copy.length > 0 ? copy : [createEmptyHttpKeyValueRow()];
}
