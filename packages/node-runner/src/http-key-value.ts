export type HttpKeyValueRow = {
  enabled?: boolean;
  key?: string;
  value?: string;
};

export function normalizeHttpKeyValueRows(raw: unknown): HttpKeyValueRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== 'object') {
      return { enabled: true, key: '', value: '' };
    }
    const row = item as Record<string, unknown>;
    return {
      enabled: row.enabled !== false,
      key: String(row.key ?? ''),
      value: String(row.value ?? ''),
    };
  });
}

export function httpKeyValueRowsToRecord(rows: HttpKeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row.key ?? '').trim();
    if (row.enabled !== false && key) {
      out[key] = String(row.value ?? '');
    }
  }
  return out;
}

export function mergeQueryIntoUrl(url: string, query: Record<string, string>): string {
  if (Object.keys(query).length === 0) return url;
  const hashIdx = url.indexOf('#');
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = withoutHash.indexOf('?');
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const existing = qIdx >= 0 ? withoutHash.slice(qIdx + 1) : '';
  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}
