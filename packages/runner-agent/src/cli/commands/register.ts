import { loadRunnerConfig, updateRunnerConfigRunnerId } from '../../config.js';
import { createExtensionHost } from '../../extension-host.js';
import { detectPlatform } from '../../platform.js';
import { registerRunner } from '../../register.js';

const AGENT_VERSION = '1.0.0';

export async function runRegister(opts: { configPath: string; token: string }): Promise<void> {
  const config = loadRunnerConfig(opts.configPath);
  const platform = detectPlatform();
  const host = createExtensionHost({ extensions: config.extensions });
  await host.ready;

  const capabilities = [...host.capabilities];
  if (config.crewaiSidecarUrl?.trim() && !capabilities.includes('crewai')) {
    capabilities.push('crewai');
  }

  const result = await registerRunner({
    serverUrl: config.serverUrl,
    registrationToken: opts.token,
    name: config.name,
    platform,
    labels: config.labels,
    capabilities,
    maxConcurrent: config.maxConcurrent,
    agentVersion: AGENT_VERSION,
    credentialFile: config.credentialFile,
  });

  updateRunnerConfigRunnerId(opts.configPath, result.runnerId);

  console.log(`Runner registered: ${result.runnerId}`);
  console.log(`Credential written to ${config.credentialFile}`);
}
