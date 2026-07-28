export async function fetchOllamaTags(
  baseUrl: string,
  fetchFn = fetch,
): Promise<Array<{ modelName: string; capabilities: string[] }>> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Ollama tags failed: ${res.status}`);
  const body = (await res.json()) as { models?: Array<{ name: string }> };
  return (body.models ?? []).map((m) => ({
    modelName: m.name,
    capabilities: ['chat'],
  }));
}
