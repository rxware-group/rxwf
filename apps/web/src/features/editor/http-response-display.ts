import {
  normalizeHttpResponseBodyContentType,
  type HttpResponseBodyContentType,
} from './http-request-types.js';

export function formatHttpResponseBodyForDisplay(
  body: unknown,
  contentType: HttpResponseBodyContentType,
): string {
  if (body === null || body === undefined) return '';

  if (contentType === 'json') {
    if (typeof body === 'string') {
      try {
        return JSON.stringify(JSON.parse(body) as unknown, null, 2);
      } catch {
        return body;
      }
    }
    return JSON.stringify(body, null, 2);
  }

  if (typeof body === 'string') return body;
  return JSON.stringify(body, null, 2);
}

export function extractHttpOutputBodies(data: unknown[]): unknown[] {
  return data.map((item) => {
    if (!item || typeof item !== 'object') return undefined;
    return (item as Record<string, unknown>).body;
  });
}

export function formatHttpOutputBodiesForDisplay(
  bodies: unknown[],
  contentType: HttpResponseBodyContentType,
): string {
  const normalized = bodies.filter((body) => body !== undefined);
  if (normalized.length === 0) return '';
  if (normalized.length === 1) {
    return formatHttpResponseBodyForDisplay(normalized[0], contentType);
  }
  if (contentType === 'json') {
    return JSON.stringify(normalized, null, 2);
  }
  return normalized
    .map((body, index) => {
      const formatted = formatHttpResponseBodyForDisplay(body, contentType);
      return `# Item ${index + 1}\n${formatted}`;
    })
    .join('\n\n');
}

export function resolveHttpOutputBodyPreview(
  data: unknown[],
  parameters: Record<string, unknown>,
): { contentType: HttpResponseBodyContentType; text: string } {
  const contentType = normalizeHttpResponseBodyContentType(parameters.responseBodyContentType);
  const text = formatHttpOutputBodiesForDisplay(extractHttpOutputBodies(data), contentType);
  return { contentType, text };
}
