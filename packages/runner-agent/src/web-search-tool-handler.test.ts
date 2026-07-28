import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunnerToolInvokeRequest } from '@rxwf/runner-protocol';
import { handleWebSearchInvoke } from './web-search-tool-handler.js';

function baseRequest(
  overrides: Partial<RunnerToolInvokeRequest> = {},
): RunnerToolInvokeRequest {
  return {
    invokeId: 'inv-ws-1',
    executionId: 'exec-1',
    nodeRunId: 'node-1',
    capability: 'web_search',
    method: 'search',
    args: { query: 'hello world' },
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe('handleWebSearchInvoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns summary from providerConfig apiKey (platform relay)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ title: 'Hit', url: 'https://example.com', content: 'snippet' }],
        }),
      })),
    );

    const res = await handleWebSearchInvoke(
      baseRequest({
        providerConfig: {
          providerId: 'tavily',
          apiKey: 'tvly-test',
        },
      }),
    );

    expect(res.status).toBe('success');
    const result = res.result as { summary: string };
    expect(result.summary).toContain('Hit');
  });

  it('rejects empty query', async () => {
    const res = await handleWebSearchInvoke(
      baseRequest({ args: { query: '  ' } }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1071');
  });

  it('rejects missing providerConfig', async () => {
    const res = await handleWebSearchInvoke(baseRequest());
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1071');
  });

  it('rejects unknown method', async () => {
    const res = await handleWebSearchInvoke(
      baseRequest({
        method: 'list',
        providerConfig: { providerId: 'tavily', apiKey: 'x' },
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E2002');
  });

  it('loads apiKey from runner-local credential file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ title: 'Local key hit', url: 'u', content: 'c' }],
        }),
      })),
    );

    const dir = await mkdtemp(join(tmpdir(), 'rxwf-ws-cred-'));
    const credFile = join(dir, 'credential.json');
    await writeFile(
      credFile,
      JSON.stringify({
        runnerId: 'r1',
        runnerCredential: 'secret',
        'web-search-key': { apiKey: 'tvly-local' },
        webSearch: { credentialRef: 'web-search-key' },
      }),
      'utf8',
    );

    const res = await handleWebSearchInvoke(
      baseRequest({
        providerConfig: { providerId: 'tavily' },
      }),
      { credentialFilePath: credFile },
    );

    expect(res.status).toBe('success');
    const result = res.result as { summary: string };
    expect(result.summary).toContain('Local key hit');
  });

  it('fails when apiKey missing for non-custom provider', async () => {
    const res = await handleWebSearchInvoke(
      baseRequest({
        providerConfig: { providerId: 'tavily' },
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1071');
  });
});
