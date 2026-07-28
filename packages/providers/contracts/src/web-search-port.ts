export interface WebSearchResult {
  summary: string;
  results?: Array<{ title?: string; url?: string; snippet?: string }>;
}

export interface WebSearchSearchRequest {
  query: string;
  /** Optional; for audit/logging only — not sent to providers. */
  explanation?: string;
}

export interface WebSearchSearchOptions {
  maxResults?: number;
  timeoutMs?: number;
  allowedDomains?: string[];
}

export interface WebSearchPort {
  search(
    request: WebSearchSearchRequest,
    options?: WebSearchSearchOptions,
  ): Promise<WebSearchResult>;
}
