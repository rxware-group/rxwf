import {
  platformEnvToRuntimeFields,
  resolvePlatformEnvMap,
  type PlatformEnvDefaults,
} from '@rxwf/env';
import type { EnvRepositoryPort } from '@rxwf/env';
import { applyLangChainTracingEnv, type RuntimeConfig } from '@rxwf/system-settings';

export async function buildRuntimeConfigFromPlatformEnv(
  repo: EnvRepositoryPort,
  defaults: PlatformEnvDefaults & { ollamaUrl: string; ollamaModel: string },
): Promise<RuntimeConfig> {
  const map = await resolvePlatformEnvMap(repo, defaults);
  const fields = platformEnvToRuntimeFields(map);
  applyLangChainTracingEnv({
    tracingV2: fields.langchain.tracingV2,
    apiKey: fields.langchain.apiKey,
    project: fields.langchain.project,
  });
  return {
    publicUrl: fields.publicUrl,
    smtp: fields.smtp,
    ollamaUrl: defaults.ollamaUrl,
    ollamaModel: defaults.ollamaModel,
    webhookSecret: fields.webhookSecret,
    brand: fields.brand,
    passwordResetEnabled:
      Boolean(fields.publicUrl) &&
      Boolean(fields.smtp.host) &&
      Boolean(fields.smtp.port) &&
      Boolean(fields.smtp.from),
    langchain: fields.langchain,
  };
}
