import type {
  WebSearchPort,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';
import { fetchJson } from '../fetch-json.js';
import { buildSummaryFromResults } from '../format-result.js';
import type { WebSearchProviderCreds } from '../types.js';

type BingResponse = {
  webPages?: {
    value?: Array<{ name?: string; url?: string; snippet?: string }>;
  };
};

export function createBingProvider(creds: WebSearchProviderCreds): WebSearchPort {
  const apiKey = creds.apiKey?.trim() ?? '';
  if (!apiKey) {
    throw new Error('Bing provider requires apiKey');
  }

  return {
    async search(request: WebSearchSearchRequest, options?: WebSearchSearchOptions) {
      const query = request.query.trim();
      const maxResults = options?.maxResults ?? 10;
      const timeoutMs = options?.timeoutMs ?? 30_000;
      const url = new URL('https://api.bing.microsoft.com/v7.0/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(maxResults));
      const data = await fetchJson<BingResponse>(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        timeoutMs,
      });
      const results = (data.webPages?.value ?? []).map((item) => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
      }));
      const summary = buildSummaryFromResults(results);
      return { summary, results };
    },
  };
}
