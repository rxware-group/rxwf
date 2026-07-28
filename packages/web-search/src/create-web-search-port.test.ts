import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTavilyProvider } from './providers/tavily.js';
import { createWebSearchPort } from './create-web-search-port.js';

describe('createWebSearchPort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns summary from tavily response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ title: 'T', url: 'u', content: 'snippet' }],
        }),
      })),
    );
    const port = createTavilyProvider({ apiKey: 'test' });
    const r = await port.search({ query: 'hello' });
    expect(r.summary).toContain('T');
  });

  it('routes provider id to factory', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        web: {
          results: [{ title: 'Brave hit', url: 'https://example.com', description: 'desc' }],
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const port = createWebSearchPort('brave', { apiKey: 'brave-key' });
    const r = await port.search({ query: 'test' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchMock.mock.calls[0] as [string] | undefined)?.[0] ?? '');
    expect(calledUrl).toContain('search.brave.com');
    expect(r.summary).toContain('Brave hit');
  });

  it('throws when tavily apiKey is missing', () => {
    expect(() => createWebSearchPort('tavily', {})).toThrow(/apiKey/i);
  });

  it('throws when custom baseUrl is missing', () => {
    expect(() => createWebSearchPort('custom', { apiKey: 'x' })).toThrow(/baseUrl/i);
  });
});
