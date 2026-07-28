import type {
  WebSearchPort,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';
import { fetchJson } from '../fetch-json.js';
import { buildSummaryFromResults } from '../format-result.js';
import type { WebSearchProviderCreds } from '../types.js';

type TavilyResponse = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
};

export function createTavilyProvider(creds: WebSearchProviderCreds): WebSearchPort {
  const apiKey = creds.apiKey?.trim() ?? '';
  if (!apiKey) {
    throw new Error('Tavily provider requires apiKey');
  }

  return {
    async search(request: WebSearchSearchRequest, options?: WebSearchSearchOptions) {
      const query = request.query.trim();
      const maxResults = options?.maxResults ?? 10;
      const timeoutMs = options?.timeoutMs ?? 30_000;
      const data = await fetchJson<TavilyResponse>('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, max_results: maxResults }),
        timeoutMs,
      });
      const results = (data.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
      }));
      const summary = buildSummaryFromResults(results);
      return { summary, results };
    },
  };
}
