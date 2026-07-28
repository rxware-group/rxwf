import type {
  WebSearchPort,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';
import { fetchJson } from '../fetch-json.js';
import { buildSummaryFromResults } from '../format-result.js';
import type { WebSearchProviderCreds } from '../types.js';

type BraveResponse = {
  web?: {
    results?: Array<{ title?: string; url?: string; description?: string }>;
  };
};

export function createBraveProvider(creds: WebSearchProviderCreds): WebSearchPort {
  const apiKey = creds.apiKey?.trim() ?? '';
  if (!apiKey) {
    throw new Error('Brave provider requires apiKey');
  }

  return {
    async search(request: WebSearchSearchRequest, options?: WebSearchSearchOptions) {
      const query = request.query.trim();
      const maxResults = options?.maxResults ?? 10;
      const timeoutMs = options?.timeoutMs ?? 30_000;
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(maxResults));
      const data = await fetchJson<BraveResponse>(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        timeoutMs,
      });
      const results = (data.web?.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
      }));
      const summary = buildSummaryFromResults(results);
      return { summary, results };
    },
  };
}
