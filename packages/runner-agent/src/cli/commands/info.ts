import { readFileSync } from 'node:fs';

import { loadRunnerConfig } from '../../config.js';
import { createExtensionHost } from '../../extension-host.js';
import type { RunnerCredentialFile } from '../../register.js';

function readRunnerIdFromCredential(path: string): string | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as RunnerCredentialFile;
    return typeof parsed.runnerId === 'string' ? parsed.runnerId : undefined;
  } catch {
    return undefined;
  }
}

export async function runInfo(configPath: string): Promise<void> {
  const config = loadRunnerConfig(configPath);
  const host = createExtensionHost({ extensions: config.extensions });
  await host.ready;

  const runnerId = config.runnerId ?? readRunnerIdFromCredential(config.credentialFile);

  console.log(
    JSON.stringify(
      {
        runnerId: runnerId ?? null,
        serverUrl: config.serverUrl,
        capabilities: host.capabilities,
      },
      null,
      2,
    ),
  );
}
