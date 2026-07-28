import { describe, expect, it } from 'vitest';
import type { WorkflowNode } from '@rxwf/workflow';
import { resolveWebSearchProviderConfig } from './resolve-web-search-provider-config.js';

const toolNode: WorkflowNode = {
  id: 'ws1',
  type: 'toolWebSearch',
  name: 'search',
  position: { x: 0, y: 0 },
  parameters: { toolDescription: 'Search the web', inheritConfig: 'true', credentialMode: 'platform' },
};

describe('resolveWebSearchProviderConfig', () => {
  it('relays platform apiKey from credential resolver', async () => {
    const config = await resolveWebSearchProviderConfig({
      toolNode,
      systemSettings: {
        enabled: true,
        defaultProvider: 'tavily',
        defaultCredentialId: 'cred-1',
        timeoutMs: 30_000,
        maxResults: 10,
      },
      resolveCredential: async (id) => {
        expect(id).toBe('cred-1');
        return { apiKey: 'tvly-platform' };
      },
    });

    expect(config).toEqual({
      providerId: 'tavily',
      apiKey: 'tvly-platform',
      timeoutMs: 30_000,
      maxResults: 10,
      allowedDomains: undefined,
      baseUrl: undefined,
    });
  });

  it('omits apiKey for runner-local credential mode', async () => {
    const localNode: WorkflowNode = {
      ...toolNode,
      parameters: {
        ...toolNode.parameters,
        credentialMode: 'runner-local',
      },
    };

    const config = await resolveWebSearchProviderConfig({
      toolNode: localNode,
      systemSettings: {
        enabled: true,
        defaultProvider: 'brave',
        defaultCredentialId: 'cred-1',
        timeoutMs: 20_000,
        maxResults: 5,
      },
      resolveCredential: async () => ({ apiKey: 'should-not-use' }),
    });

    expect(config?.apiKey).toBeUndefined();
    expect(config?.providerId).toBe('brave');
  });
});
