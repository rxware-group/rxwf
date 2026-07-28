import { AwfError } from '@rxwf/shared';

export interface OpenAiCompatibleEmbeddingsOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function createOpenAiCompatibleEmbeddings(options: OpenAiCompatibleEmbeddingsOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const model = options.model;
  const apiKey = options.apiKey;
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async embed(text: string): Promise<number[]> {
      const res = await fetchFn(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
      });
      if (!res.ok) {
        throw new AwfError('E3002', `OpenAI-compatible embeddings failed: ${res.status}`);
      }
      const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const embedding = body.data?.[0]?.embedding;
      if (!embedding?.length) {
        throw new AwfError('E3002', 'OpenAI-compatible returned empty embedding');
      }
      return embedding;
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const out: number[][] = [];
      for (const text of texts) {
        out.push(await this.embed(text));
      }
      return out;
    },
  };
}
