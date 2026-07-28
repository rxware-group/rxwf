import { describe, it, expect, vi } from 'vitest';
import { toRemoteJob } from './to-remote-job.js';

describe('toRemoteJob', () => {
  it('strips credentialId from nodeConfig', async () => {
    const job = await toRemoteJob({
      executionId: 'ex-1',
      nodeRunId: 'nr-1',
      nodeType: 'code',
      nodeConfig: { jsCode: 'return items;', credentialId: 'cred-1' },
      inputItems: [{ json: {} }],
      workflowSettings: {},
      mode: 'production',
    });

    expect(job.nodeConfig.credentialId).toBeUndefined();
    expect(job.nodeConfig.jsCode).toBe('return items;');
  });

  it('merges credential auth headers for httpRequest', async () => {
    const resolveCredentialForAuth = vi.fn(async () => ({
      type: 'apiKey',
      data: {
        apiKey: 'sk-test',
        headerName: 'Authorization',
        prefix: 'Bearer',
      },
    }));

    const job = await toRemoteJob(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'httpRequest',
        nodeConfig: {
          url: 'https://example.com',
          method: 'GET',
          credentialId: 'cred-1',
        },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
      },
      { resolveCredentialForAuth },
    );

    expect(resolveCredentialForAuth).toHaveBeenCalledWith('cred-1');
    expect(job.nodeConfig.credentialId).toBeUndefined();
    expect(job.nodeConfig.headers).toEqual({
      Authorization: 'Bearer sk-test',
    });
  });

  it('merges headerParameters after credential headers', async () => {
    const resolveCredentialForAuth = vi.fn(async () => ({
      type: 'apiKey',
      data: {
        apiKey: 'sk-test',
        headerName: 'Authorization',
        prefix: 'Bearer',
      },
    }));

    const job = await toRemoteJob(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'httpRequest',
        nodeConfig: {
          url: 'https://example.com',
          method: 'GET',
          credentialId: 'cred-1',
          sendHeaders: true,
          headerParameters: [
            { enabled: true, key: 'X-Custom', value: 'custom-value' },
          ],
        },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
      },
      { resolveCredentialForAuth },
    );

    expect(job.nodeConfig.headers).toEqual({
      Authorization: 'Bearer sk-test',
      'X-Custom': 'custom-value',
    });
    expect(job.nodeConfig.credentialId).toBeUndefined();
  });

  it('manual Authorization overrides credential for httpRequest', async () => {
    const job = await toRemoteJob(
      {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
        nodeType: 'httpRequest',
        nodeConfig: {
          url: 'https://example.com',
          method: 'GET',
          credentialId: 'cred-1',
          headers: { Authorization: 'Bearer manual' },
        },
        inputItems: [{ json: {} }],
        workflowSettings: {},
        mode: 'production',
      },
      {
        resolveCredentialForAuth: async () => ({
          type: 'apiKey',
          data: {
            apiKey: 'sk-from-credential',
            headerName: 'Authorization',
            prefix: 'Bearer',
          },
        }),
      },
    );

    expect(job.nodeConfig.headers).toEqual({ Authorization: 'Bearer manual' });
    expect(job.nodeConfig.credentialId).toBeUndefined();
  });
});
