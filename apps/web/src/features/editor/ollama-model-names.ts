import { api } from '../../api/client.js';

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export function isLiteralHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) && !trimmed.includes('{{');
}

export function parseOllamaTagsResponse(body: unknown): string[] {
  const data = body as { models?: Array<{ name: string }> };
  return (data.models ?? []).map((m) => m.name);
}

export async function fetchOllamaModelNamesFromUrl(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const body = await res.json();
  return parseOllamaTagsResponse(body);
}

export function mergeModelNames(...lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));
}

export async function loadOllamaModelNames(baseUrl?: string): Promise<string[]> {
  const collected: string[][] = [];
  let providers: Awaited<ReturnType<typeof api.models.listProviders>> = [];
  let catalogModels: Awaited<ReturnType<typeof api.models.list>> = [];

  try {
    [providers, catalogModels] = await Promise.all([
      api.models.listProviders(),
      api.models.list('chat'),
    ]);
    const ollamaIds = new Set(
      providers.filter((p) => p.kind === 'ollama' && p.enabled).map((p) => p.id),
    );
    collected.push(
      catalogModels
        .filter((m) => m.enabled && ollamaIds.has(m.providerId))
        .map((m) => m.modelName),
    );
  } catch {
    // catalog optional
  }

  let liveUrl = DEFAULT_OLLAMA_URL;
  if (baseUrl && isLiteralHttpUrl(baseUrl)) {
    liveUrl = baseUrl.trim();
  } else {
    const workflowDefault = catalogModels.find((m) => m.enabled && m.isDefaultWorkflow);
    if (workflowDefault) {
      const provider = providers.find((p) => p.id === workflowDefault.providerId);
      if (provider?.baseUrl?.trim()) {
        liveUrl = provider.baseUrl.trim();
      }
    } else {
      const ollamaProvider = providers.find((p) => p.kind === 'ollama' && p.enabled);
      if (ollamaProvider?.baseUrl?.trim()) {
        liveUrl = ollamaProvider.baseUrl.trim();
      }
    }
  }

  try {
    const live = await fetchOllamaModelNamesFromUrl(liveUrl);
    collected.push(live);
  } catch {
    // ollama may be offline
  }

  return mergeModelNames(...collected);
}
