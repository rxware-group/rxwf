import { readFile } from 'node:fs/promises';
import type {
  RunnerToolInvokeRequest,
  RunnerToolInvokeResult,
  WebSearchProviderConfig,
} from '@rxwf/runner-protocol';
import { createWebSearchPort } from '@rxwf/web-search';

export interface WebSearchToolHandlerOptions {
  credentialFilePath?: string;
}

async function loadCredentialFile(
  credentialFilePath: string,
): Promise<Record<string, unknown>> {
  try {
    const raw = JSON.parse(await readFile(credentialFilePath, 'utf8'));
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function resolveProviderCreds(
  providerConfig: WebSearchProviderConfig,
  opts?: WebSearchToolHandlerOptions,
): Promise<{ apiKey?: string; baseUrl?: string }> {
  if (providerConfig.apiKey?.trim()) {
    return {
      apiKey: providerConfig.apiKey.trim(),
      baseUrl: providerConfig.baseUrl?.trim(),
    };
  }

  if (!opts?.credentialFilePath) {
    return { baseUrl: providerConfig.baseUrl?.trim() };
  }

  const file = await loadCredentialFile(opts.credentialFilePath);
  const webSearch = file.webSearch;
  if (webSearch && typeof webSearch === 'object' && !Array.isArray(webSearch)) {
    const ws = webSearch as Record<string, unknown>;
    const ref = typeof ws.credentialRef === 'string' ? ws.credentialRef.trim() : '';
    if (ref) {
      const entry = file[ref];
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const cred = entry as Record<string, unknown>;
        const apiKey = typeof cred.apiKey === 'string' ? cred.apiKey.trim() : '';
        if (apiKey) {
          return {
            apiKey,
            baseUrl:
              typeof cred.baseUrl === 'string'
                ? cred.baseUrl.trim()
                : providerConfig.baseUrl?.trim(),
          };
        }
      }
    }
    const direct = typeof ws.apiKey === 'string' ? ws.apiKey.trim() : '';
    if (direct) {
      return { apiKey: direct, baseUrl: providerConfig.baseUrl?.trim() };
    }
  }

  return { baseUrl: providerConfig.baseUrl?.trim() };
}

export async function handleWebSearchInvoke(
  request: RunnerToolInvokeRequest,
  opts?: WebSearchToolHandlerOptions,
): Promise<RunnerToolInvokeResult> {
  const started = Date.now();
  const fail = (errorCode: string, errorMessage: string): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'failed',
    errorCode,
    errorMessage,
    durationMs: Date.now() - started,
  });

  if (request.method !== 'search') {
    return fail('E2002', `Unknown web_search method: ${request.method}`);
  }

  const query = String(request.args.query ?? request.args.q ?? '').trim();
  if (!query) {
    return fail('E1071', 'web_search requires a non-empty query');
  }

  const providerConfig = request.providerConfig;
  if (!providerConfig?.providerId) {
    return fail('E1071', 'web_search providerConfig.providerId is required');
  }

  try {
    const { apiKey, baseUrl } = await resolveProviderCreds(providerConfig, opts);
    if (providerConfig.providerId !== 'custom' && !apiKey) {
      return fail('E1071', 'Web search apiKey not configured');
    }
    const resolvedBaseUrl = baseUrl ?? providerConfig.baseUrl?.trim();
    if (providerConfig.providerId === 'custom' && !resolvedBaseUrl) {
      return fail('E1071', 'custom provider requires baseUrl');
    }

    const port = createWebSearchPort(providerConfig.providerId, {
      apiKey,
      baseUrl: resolvedBaseUrl,
    });

    const maxResults =
      typeof request.args.maxResults === 'number'
        ? request.args.maxResults
        : providerConfig.maxResults;
    const allowedDomains = Array.isArray(request.args.allowedDomains)
      ? (request.args.allowedDomains as unknown[]).map(String).filter(Boolean)
      : providerConfig.allowedDomains;
    const timeoutMs =
      request.timeoutMs > 0 ? request.timeoutMs : (providerConfig.timeoutMs ?? 30_000);

    const result = await port.search(
      { query },
      { maxResults, allowedDomains, timeoutMs },
    );

    return {
      invokeId: request.invokeId,
      status: 'success',
      result: { summary: result.summary, results: result.results },
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return fail('E1074', e instanceof Error ? e.message : String(e));
  }
}
