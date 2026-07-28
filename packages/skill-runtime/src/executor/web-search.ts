import { skillError } from '../errors.js';
import type {
  WebSearchPort,
  WebSearchSearchOptions,
  WebSearchSearchRequest,
} from '@rxwf/providers-contracts';

function normalizeRequest(
  request: string | WebSearchSearchRequest,
): WebSearchSearchRequest {
  if (typeof request === 'string') {
    return { query: request };
  }
  return request;
}

export async function dispatchWebSearch(
  port: WebSearchPort | undefined,
  request: string | WebSearchSearchRequest,
  hasNetworkPermission: boolean,
  options?: WebSearchSearchOptions,
): Promise<string> {
  if (!hasNetworkPermission) {
    throw skillError('E1072', 'Skill lacks network permission for web_search');
  }
  if (!port) {
    throw skillError('E1071', 'Web search provider is not configured');
  }
  const req = normalizeRequest(request);
  const q = String(req.query ?? '').trim();
  if (!q) {
    throw skillError('E1071', 'web_search requires a non-empty query');
  }
  const result = await port.search({ ...req, query: q }, options);
  return result.summary;
}
