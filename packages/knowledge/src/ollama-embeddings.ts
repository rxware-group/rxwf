import { AwfError } from '@rxwf/shared';

export interface OllamaEmbeddingsOptions {
  baseUrl: string;
  model: string;
  fetchFn?: typeof fetch;
}

export function createOllamaEmbeddings(options: OllamaEmbeddingsOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const model = options.model;
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async embed(text: string): Promise<number[]> {
      const res = await fetchFn(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });
      if (!res.ok) {
        throw new AwfError('E3002', `Ollama embeddings failed: ${res.status}`);
      }
      const body = (await res.json()) as { embedding?: number[] };
      if (!body.embedding?.length) {
        throw new AwfError('E3002', 'Ollama returned empty embedding');
      }
      return body.embedding;
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
