import { skillError } from '../errors.js';
import type {
  WebSearchPort,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';

export interface WebSearchCitation {
  title?: string;
  url?: string;
  snippet?: string;
}

export interface WebSearchToolResult {
  summary: string;
  citations: WebSearchCitation[];
}

export interface WebSearchToolInput {
  query: string;
  explanation?: string;
  maxResults?: number;
  allowedDomains?: string[];
  timeoutMs?: number;
}

function toCitations(
  results?: Array<{ title?: string; url?: string; snippet?: string }>,
): WebSearchCitation[] {
  if (!results?.length) return [];
  return results.map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
  }));
}

export async function invokeWebSearch(
  port: WebSearchPort | undefined,
  input: WebSearchToolInput,
  options?: WebSearchSearchOptions,
): Promise<WebSearchToolResult> {
  if (!port) {
    throw skillError('E1071', 'Web search provider is not configured');
  }

  const query = String(input.query ?? '').trim();
  if (!query) {
    throw skillError('E1071', 'web_search requires a non-empty query');
  }

  const request: WebSearchSearchRequest = {
    query,
    explanation: input.explanation,
  };
  const searchOptions: WebSearchSearchOptions = {
    maxResults: input.maxResults ?? options?.maxResults,
    timeoutMs: input.timeoutMs ?? options?.timeoutMs,
    allowedDomains: input.allowedDomains ?? options?.allowedDomains,
  };

  const result = await port.search(request, searchOptions);
  return {
    summary: result.summary,
    citations: toCitations(result.results),
  };
}
