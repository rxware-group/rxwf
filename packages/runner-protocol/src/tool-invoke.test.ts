import { describe, expect, it } from 'vitest';
import type {
  RunnerToolCapability,
  RunnerToolInvokeRequest,
  WebSearchProviderConfig,
} from './tool-invoke.js';

describe('RunnerToolInvokeRequest', () => {
  it('includes web_search in RunnerToolCapability', () => {
    const caps: RunnerToolCapability[] = [
      'skill:filesystem',
      'shell',
      'web_search',
      'admin:filesystem',
    ];
    expect(caps).toContain('web_search');
  });

  it('accepts web_search invoke with providerConfig and optional scanRoots', () => {
    const providerConfig: WebSearchProviderConfig = {
      providerId: 'tavily',
      apiKey: 'tvly-test',
      maxResults: 5,
    };
    const req: RunnerToolInvokeRequest = {
      invokeId: 'inv-1',
      executionId: 'exec-1',
      nodeRunId: 'node-1',
      capability: 'web_search',
      method: 'search',
      args: { query: 'rx-workflow' },
      timeoutMs: 30_000,
      providerConfig,
    };
    expect(req.providerConfig?.providerId).toBe('tavily');
    expect(req.scanRoots).toBeUndefined();
  });

  it('accepts filesystem invoke with scanRoots', () => {
    const req: RunnerToolInvokeRequest = {
      invokeId: 'inv-2',
      executionId: 'exec-1',
      nodeRunId: 'node-1',
      capability: 'skill:filesystem',
      method: 'read',
      args: { path: '/tmp/a.txt' },
      scanRoots: ['/tmp'],
      timeoutMs: 60_000,
    };
    expect(req.scanRoots).toEqual(['/tmp']);
  });
});
