import type {
  WebSearchPort,
  WebSearchResult,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';
import { fetchJson } from '../fetch-json.js';
import { buildSummaryFromResults } from '../format-result.js';
import type { WebSearchProviderCreds } from '../types.js';

type CustomResponse = {
  summary?: string;
  results?: WebSearchResult['results'];
};

export function createCustomProvider(creds: WebSearchProviderCreds): WebSearchPort {
  const baseUrl = creds.baseUrl?.trim().replace(/\/+$/, '') ?? '';
  if (!baseUrl) {
    throw new Error('Custom provider requires baseUrl');
  }

  return {
    async search(request: WebSearchSearchRequest, options?: WebSearchSearchOptions) {
      const query = request.query.trim();
      const maxResults = options?.maxResults ?? 10;
      const timeoutMs = options?.timeoutMs ?? 30_000;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      const apiKey = creds.apiKey?.trim();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const data = await fetchJson<CustomResponse>(`${baseUrl}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, maxResults }),
        timeoutMs,
      });
      const results = data.results ?? [];
      const summary =
        data.summary?.trim() || (results.length > 0 ? buildSummaryFromResults(results) : '');
      return { summary, results };
    },
  };
}
