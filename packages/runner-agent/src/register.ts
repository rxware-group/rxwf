import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { RunnerPlatform } from './platform.js';

/** Credential file format: JSON object written by {@link registerRunner}. */
export interface RunnerCredentialFile {
  runnerId: string;
  runnerCredential: string;
}

export async function registerRunner(opts: {
  serverUrl: string;
  registrationToken: string;
  name: string;
  platform: RunnerPlatform;
  labels?: string[];
  capabilities: string[];
  maxConcurrent?: number;
  agentVersion?: string;
  credentialFile: string;
}): Promise<{ runnerId: string; runnerCredential: string }> {
  const base = opts.serverUrl.replace(/\/$/, '');
  const url = `${base}/api/runners/register`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registrationToken: opts.registrationToken,
      name: opts.name,
      platform: opts.platform,
      labels: opts.labels,
      capabilities: opts.capabilities,
      maxConcurrent: opts.maxConcurrent,
      agentVersion: opts.agentVersion,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Runner registration failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { runnerId: string; runnerCredential: string };
  if (!data.runnerId || !data.runnerCredential) {
    throw new Error('Runner registration response missing runnerId or runnerCredential');
  }

  const credential: RunnerCredentialFile = {
    runnerId: data.runnerId,
    runnerCredential: data.runnerCredential,
  };
  mkdirSync(dirname(opts.credentialFile), { recursive: true });
  writeFileSync(opts.credentialFile, `${JSON.stringify(credential, null, 2)}\n`, 'utf8');

  return data;
}
