import { describe, expect, it } from 'vitest';
import { dispatchWebSearch } from './web-search.js';

describe('dispatchWebSearch', () => {
  it('throws E1072 without network permission', async () => {
    await expect(dispatchWebSearch(undefined, 'q', false)).rejects.toMatchObject({
      code: 'E1072',
    });
  });

  it('throws E1071 without provider', async () => {
    await expect(dispatchWebSearch(undefined, 'q', true)).rejects.toMatchObject({
      code: 'E1071',
    });
  });

  it('returns summary from port with string query', async () => {
    const summary = await dispatchWebSearch(
      {
        search: async (request) => ({ summary: `found: ${request.query}` }),
      },
      'hello',
      true,
    );
    expect(summary).toBe('found: hello');
  });

  it('returns summary from port with request object', async () => {
    const summary = await dispatchWebSearch(
      {
        search: async (request, options) => ({
          summary: `${request.query}:${options?.maxResults ?? 0}`,
        }),
      },
      { query: 'hello', explanation: 'test' },
      true,
      { maxResults: 5 },
    );
    expect(summary).toBe('hello:5');
  });
});
