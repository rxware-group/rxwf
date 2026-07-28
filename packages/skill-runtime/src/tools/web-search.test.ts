import { describe, expect, it } from 'vitest';
import { invokeWebSearch } from './web-search.js';

describe('invokeWebSearch', () => {
  it('throws E1071 when provider is not configured', async () => {
    await expect(invokeWebSearch(undefined, { query: 'hello' })).rejects.toMatchObject({
      code: 'E1071',
    });
  });

  it('returns citations from mock provider', async () => {
    const result = await invokeWebSearch(
      {
        search: async () => ({
          summary: 'found items',
          results: [
            { title: 'Example', url: 'https://example.com', snippet: 'snippet text' },
          ],
        }),
      },
      { query: 'test query' },
    );

    expect(result.summary).toBe('found items');
    expect(result.citations).toEqual([
      { title: 'Example', url: 'https://example.com', snippet: 'snippet text' },
    ]);
  });
});
