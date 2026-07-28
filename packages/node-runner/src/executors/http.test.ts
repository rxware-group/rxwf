import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerBuiltinExecutors } from './register-builtin.js';
import { createHttpRequestExecutor, httpRequestExecutor } from './http.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const httpRequestAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/httpRequest.md');

function createFetchResponse(
  body: unknown,
  options: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    url?: string;
    headers?: Record<string, string>;
    arrayBufferBody?: ArrayBuffer;
  } = {},
) {
  const status = options.status ?? (options.ok === false ? 500 : 200);
  const ok = options.ok ?? (status >= 200 && status < 300);
  const headers = new Headers(
    options.headers ?? { 'content-type': 'application/json; charset=utf-8' },
  );
  const text =
    typeof body === 'string' ? body : body === undefined || body === null ? '' : JSON.stringify(body);
  const arrayBuffer =
    options.arrayBufferBody ??
    (text ? new TextEncoder().encode(text).buffer : new ArrayBuffer(0));
  return {
    ok,
    status,
    statusText: options.statusText ?? (ok ? 'OK' : 'Internal Server Error'),
    url: options.url ?? 'https://example.com/api',
    redirected: false,
    headers,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => text,
    arrayBuffer: async () => arrayBuffer,
  };
}

describe('httpRequestExecutor registration', () => {
  it('registerBuiltinExecutors registers httpRequest', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('httpRequest')).toBe(true);
  });
});

describe('httpRequest M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(httpRequestAuditRowPath)).toBe(true);
    const content = readFileSync(httpRequestAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-httpRequest');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-httpRequest');
  });
});

describe('httpRequestExecutor', () => {
  const oldConcurrency = process.env.RXWF_HTTP_NODE_CONCURRENCY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (oldConcurrency == null) {
      delete process.env.RXWF_HTTP_NODE_CONCURRENCY;
    } else {
      process.env.RXWF_HTTP_NODE_CONCURRENCY = oldConcurrency;
    }
  });

  it('GET request returns full HTTP response in output items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createFetchResponse(
          { hello: 'world' },
          {
            headers: {
              'content-type': 'application/json',
              'x-response-id': 'abc-123',
            },
          },
        ),
      ),
    );

    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
      },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json).toMatchObject({
      ok: true,
      statusCode: 200,
      statusMessage: 'OK',
      url: 'https://example.com/api',
      requestUrl: 'https://example.com/api',
      headers: {
        'content-type': 'application/json',
        'x-response-id': 'abc-123',
      },
      body: { hello: 'world' },
      request: {
        method: 'GET',
        url: 'https://example.com/api',
        headers: {},
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('resolves {{ $env }} and {{ $json }} in URL per item', async () => {
    process.env.RXWF_HTTP_NODE_CONCURRENCY = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => createFetchResponse({ url }, { url })),
    );

    const result = await httpRequestExecutor.execute({
      config: {
        url: '{{ $env.API_URL }}/users/{{ $json.id }}',
        method: 'GET',
      },
      env: { API_URL: 'https://api.example.com' },
      inputItems: [{ json: { id: 1 } }, { json: { id: 2 } }],
    });

    expect(result.status).toBe('success');
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/users/1',
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/users/2',
      expect.any(Object),
    );
    expect(result.outputItems?.[0]).toHaveLength(2);
  });

  it('runs input items with configured concurrency and preserves output order', async () => {
    process.env.RXWF_HTTP_NODE_CONCURRENCY = '2';
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return createFetchResponse({ url }, { url });
      }),
    );
    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/{{ $json.id }}',
        method: 'GET',
      },
      inputItems: [
        { json: { id: 'a' } },
        { json: { id: 'b' } },
        { json: { id: 'c' } },
      ],
    });

    expect(result.status).toBe('success');
    expect(maxActive).toBeGreaterThan(1);
    expect(result.outputItems?.[0]?.map((item) => item.json.requestUrl)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);
  });

  it('returns success with per-item errors in best-effort mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/bad')) {
          return createFetchResponse({ err: 'x' }, { ok: false, status: 500, url });
        }
        return createFetchResponse({ ok: true }, { url });
      }),
    );
    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/{{ $json.id }}',
        method: 'GET',
      },
      inputItems: [{ json: { id: 'good' } }, { json: { id: 'bad' } }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.ok).toBe(true);
    expect(result.outputItems?.[0]?.[1]?.json.ok).toBe(false);
    expect(result.outputItems?.[0]?.[1]?.json.body).toEqual({ err: 'x' });
    expect(result.outputItems?.[0]?.[1]?.json.error).toContain('HTTP 500');
  });

  it('passes a keep-alive dispatcher to fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse({ ok: true })),
    );
    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
      },
      inputItems: [{ json: {} }],
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        dispatcher: expect.any(Object),
      }),
    );
  });

  it('credential injects Authorization Bearer when no manual override', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse({})),
    );

    const executor = createHttpRequestExecutor({
      resolveCredentialForAuth: async () => ({
        type: 'apiKey',
        data: {
          apiKey: 'sk-test',
          headerName: 'Authorization',
          prefix: 'Bearer',
        },
      }),
    });

    await executor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
        credentialId: 'cred-1',
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('manual Authorization header overrides credential', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse({})),
    );

    const executor = createHttpRequestExecutor({
      resolveCredentialForAuth: async () => ({
        type: 'apiKey',
        data: {
          apiKey: 'sk-from-credential',
          headerName: 'Authorization',
          prefix: 'Bearer',
        },
      }),
    });

    await executor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
        credentialId: 'cred-1',
        headers: { Authorization: 'Bearer manual' },
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer manual' }),
      }),
    );
  });

  it('merges query parameters into URL when sendQuery is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => createFetchResponse({ url }, { url })),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
        sendQuery: true,
        queryParameters: [
          { enabled: true, key: 'foo', value: 'bar' },
          { enabled: false, key: 'skip', value: 'me' },
        ],
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api?foo=bar',
      expect.any(Object),
    );
  });

  it('sends enabled header rows when sendHeaders is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ headers: init?.headers }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
        sendHeaders: true,
        headerParameters: [
          { enabled: true, key: 'X-Custom', value: 'yes' },
          { enabled: false, key: 'X-Skip', value: 'no' },
        ],
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Custom': 'yes' }),
      }),
    );
    const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = call?.headers as Record<string, string> | undefined;
    expect(headers?.['X-Skip']).toBeUndefined();
  });

  it('sends form-urlencoded body from bodyParameters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'x-www-form-urlencoded',
        bodyParameters: [
          { enabled: true, key: 'a', value: '1' },
          { enabled: true, key: 'b', value: '2' },
        ],
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: 'a=1&b=2',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );
  });

  it('sends multipart form-data body from bodyParameters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'form-data',
        bodyParameters: [
          { enabled: true, key: 'name', value: 'alice' },
          { enabled: true, key: 'file', value: 'hello' },
        ],
      },
      inputItems: [{ json: {} }],
    });

    const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
    expect(call?.body).toBeInstanceOf(FormData);
    expect((call?.body as FormData).get('name')).toBe('alice');
    expect((call?.body as FormData).get('file')).toBe('hello');
  });

  it('sends binary body decoded from base64', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'binary',
        body: Buffer.from('hello').toString('base64'),
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: Buffer.from('hello'),
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      }),
    );
  });

  it('sends GraphQL body as JSON payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'graphql',
        body: '{ hello }',
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '{ hello }' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('does not send body when bodyContentType is none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'none',
        body: '{"ignored":true}',
      },
      inputItems: [{ json: {} }],
    });

    const call = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined;
    expect(call?.body).toBeUndefined();
  });

  it('maps legacy json body type to raw application/json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'json',
        body: '{"hello":"world"}',
      },
      inputItems: [{ json: {} }],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: '{"hello":"world"}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('always includes response headers in node output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) =>
        createFetchResponse(
          { ok: true },
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
        outputResponseHeaders: false,
        outputResponseBody: true,
      },
      inputItems: [{ json: {} }],
    });

    expect(result.outputItems?.[0]?.[0]?.json.headers).toEqual({
      'content-type': 'application/json',
    });
    expect(result.outputItems?.[0]?.[0]?.json.body).toEqual({ ok: true });
    expect(result.outputItems?.[0]?.[0]?.json.statusCode).toBe(200);
  });

  it('stores PNG response in item.binary when responseBinaryMode is auto', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createFetchResponse(null, {
          headers: { 'content-type': 'image/png' },
          arrayBufferBody: pngHeader.buffer.slice(
            pngHeader.byteOffset,
            pngHeader.byteOffset + pngHeader.byteLength,
          ),
        }),
      ),
    );

    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/image.png',
        method: 'GET',
        responseBinaryMode: 'auto',
      },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    const item = result.outputItems?.[0]?.[0];
    expect(item?.binary?.data?.mimeType).toBe('image/png');
    expect(item?.json.body).toBeUndefined();
    expect(item?.json.statusCode).toBe(200);
  });

  it('sends item binary when bodyContentType is binaryFromItem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        createFetchResponse({ body: init?.body }),
      ),
    );

    const payload = Buffer.from('upload-me');
    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/upload',
        method: 'POST',
        sendBody: true,
        bodyContentType: 'binaryFromItem',
        binaryBodyPropertyName: 'data',
      },
      inputItems: [
        {
          json: { id: 1 },
          binary: {
            data: {
              data: payload.toString('base64'),
              mimeType: 'image/png',
              fileSize: payload.length,
            },
          },
        },
      ],
    });

    expect(result.status).toBe('success');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/upload',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        headers: expect.objectContaining({
          'Content-Type': 'image/png',
        }),
      }),
    );
  });

  it('preserves input binary when response has no binary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse({ ok: true })),
    );

    const inputBinary = {
      upload: {
        data: Buffer.from('hello').toString('base64'),
        mimeType: 'text/plain',
        fileSize: 5,
      },
    };
    const result = await httpRequestExecutor.execute({
      config: {
        url: 'https://example.com/api',
        method: 'GET',
      },
      inputItems: [{ json: { id: 1 }, binary: inputBinary }],
    });

    expect(result.outputItems?.[0]?.[0]?.binary).toEqual(inputBinary);
  });
});
