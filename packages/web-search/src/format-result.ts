import type { WebSearchResult } from '@rxwf/providers-contracts';

export const SNIPPET_MAX_BYTES = 2048;
export const SUMMARY_MAX_BYTES = 8192;

export function truncateText(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (encoder.encode(text.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

export function buildSummaryFromResults(
  results: NonNullable<WebSearchResult['results']>,
): string {
  const lines: string[] = [];
  for (const item of results) {
    const title = item.title?.trim() || '(untitled)';
    const url = item.url?.trim() || '';
    const snippet = truncateText(item.snippet?.trim() || '', SNIPPET_MAX_BYTES);
    lines.push(`- **${title}**${url ? ` (${url})` : ''}${snippet ? `\n  ${snippet}` : ''}`);
  }
  return truncateText(lines.join('\n'), SUMMARY_MAX_BYTES);
}
