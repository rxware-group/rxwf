import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerRunner, type RunnerCredentialFile } from './register.js';

describe('registerRunner', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs registration payload and writes JSON credential file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rxwf-runner-register-'));
    const credentialFile = join(dir, 'nested', 'credential.json');

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        runnerId: 'runner-abc',
        runnerCredential: 'secret-cred',
      }),
    })) as unknown as typeof fetch;

    const result = await registerRunner({
      serverUrl: 'https://rxwf.example.com/',
      registrationToken: 'tok-1',
      name: 'win-build-01',
      platform: { os: 'windows', arch: 'x64' },
      labels: ['ci'],
      capabilities: ['code', 'shell'],
      maxConcurrent: 2,
      agentVersion: '1.0.0',
      credentialFile,
    });

    expect(result).toEqual({
      runnerId: 'runner-abc',
      runnerCredential: 'secret-cred',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://rxwf.example.com/api/runners/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body).toEqual({
      registrationToken: 'tok-1',
      name: 'win-build-01',
      platform: { os: 'windows', arch: 'x64' },
      labels: ['ci'],
      capabilities: ['code', 'shell'],
      maxConcurrent: 2,
      agentVersion: '1.0.0',
    });

    const written = JSON.parse(readFileSync(credentialFile, 'utf8')) as RunnerCredentialFile;
    expect(written).toEqual({
      runnerId: 'runner-abc',
      runnerCredential: 'secret-cred',
    });
  });

  it('throws when registration HTTP fails', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    })) as unknown as typeof fetch;

    await expect(
      registerRunner({
        serverUrl: 'http://localhost:3000',
        registrationToken: 'tok',
        name: 'agent',
        platform: { os: 'linux', arch: 'x64' },
        capabilities: ['code'],
        credentialFile: join(tmpdir(), 'cred.json'),
      }),
    ).rejects.toThrow('Runner registration failed (400)');
  });
});
