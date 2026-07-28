import type { RunnerExtension } from '@rxwf/runner-sdk';
import { validateExtensionManifest } from '@rxwf/runner-sdk';

import { loadRunnerConfig } from '../../config.js';

const RUNNER_SDK_VERSION = '1.0.0';

export async function runValidateExtensions(configPath: string): Promise<void> {
  const config = loadRunnerConfig(configPath);
  const extensions = config.extensions ?? [];

  if (extensions.length === 0) {
    console.log('No extensions configured.');
    return;
  }

  let failed = false;

  for (const spec of extensions) {
    try {
      const mod = (await import(spec)) as { default?: RunnerExtension };
      const extension = mod.default;
      if (!extension?.manifest) {
        throw new Error('must export a default RunnerExtension with manifest');
      }

      const validation = validateExtensionManifest(extension.manifest, RUNNER_SDK_VERSION);
      if (!validation.ok) {
        throw new Error(validation.reason);
      }

      console.log(`OK ${spec} (${extension.manifest.id}@${extension.manifest.version})`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${spec}: ${message}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
