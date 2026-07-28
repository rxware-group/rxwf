import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

import { E2016 } from '@rxwf/runner-protocol';
import type { RemoteNodeRunJob } from '@rxwf/runner-protocol';

import { createExtensionHost } from './extension-host.js';

function makeJob(nodeType: string, nodeConfig: Record<string, unknown> = {}): RemoteNodeRunJob {
  return {
    jobId: 'job-1',
    executionId: 'exec-1',
    nodeRunId: 'node-run-1',
    nodeType,
    nodeConfig,
    inputItems: [{ json: {} }],
    mode: 'production',
    workflowSettings: {},
    timeoutMs: 30_000,
  };
}

function createFetchResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    redirected: false,
    url: 'https://example.com',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  };
}

describe('createExtensionHost', () => {
  it('aggregates core capabilities including web_search', () => {
    const host = createExtensionHost();
    expect(host.capabilities).toEqual(
      expect.arrayContaining(['code', 'shell', 'http', 'file', 'web_search']),
    );
    expect(host.capabilities).toHaveLength(5);
  });

  it('returns E2016 for unknown nodeType', async () => {
    const host = createExtensionHost();
    const result = await host.execute(makeJob('set'));

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe(E2016);
    expect(result.errorMessage).toContain('set');
  });

  it('executes httpRequest via core executor without credential resolver', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => createFetchResponse({ ok: true })),
    );

    const host = createExtensionHost();
    const result = await host.execute(
      makeJob('httpRequest', { url: 'https://example.com', method: 'GET' }),
    );

    expect(result.status).toBe('success');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('executes readWriteFile via core executor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-agent-rw-'));
    const path = join(dir, 'remote.txt');

    const host = createExtensionHost();
    const writeResult = await host.execute(
      makeJob('readWriteFile', { operation: 'write', path, content: 'remote runner' }),
    );
    expect(writeResult.status).toBe('success');

    const readResult = await host.execute(
      makeJob('readWriteFile', { operation: 'read', path }),
    );
    expect(readResult.status).toBe('success');
    expect(readResult.outputItems?.[0]?.[0]?.json.content).toBe('remote runner');
    expect(await readFile(path, 'utf8')).toBe('remote runner');
  });
});
