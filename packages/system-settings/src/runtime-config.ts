import type { SystemSettingsService } from "./system-settings-service.js";
import { applyLangChainTracingEnv } from "./apply-langchain-tracing.js";
import { SETTING_KEYS } from "./keys.js";

export interface EnvDefaults {
  publicUrl: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  ollamaUrl: string;
  ollamaModel: string;
  webhookSecret: string;
  brandProductName?: string;
  brandLogoUrl?: string;
  langchainTracingV2?: string;
  langchainApiKey?: string;
  langchainProject?: string;
}

export interface RuntimeConfig {
  publicUrl: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  ollamaUrl: string;
  ollamaModel: string;
  webhookSecret: string;
  brand: { productName: string; logoUrl: string };
  passwordResetEnabled: boolean;
  langchain: {
    tracingV2: boolean;
    apiKey: string;
    project: string;
    enabled: boolean;
  };
}

export async function getRuntimeConfig(
  settings: SystemSettingsService,
  env: EnvDefaults,
): Promise<RuntimeConfig> {
  const pick = async (key: string, fallback: string) =>
    (await settings.get(key)) ?? fallback;

  const publicUrl = await pick(SETTING_KEYS.publicUrl, env.publicUrl);
  const smtp = {
    host: await pick(SETTING_KEYS.smtpHost, env.smtpHost ?? ""),
    port: Number(await pick(SETTING_KEYS.smtpPort, env.smtpPort ?? "587")),
    secure: (await pick(SETTING_KEYS.smtpSecure, env.smtpSecure ?? "false")) === "true",
    user: await pick(SETTING_KEYS.smtpUser, env.smtpUser ?? ""),
    password: await pick(SETTING_KEYS.smtpPassword, env.smtpPassword ?? ""),
    from: await pick(SETTING_KEYS.smtpFrom, env.smtpFrom ?? ""),
  };
  const passwordResetEnabled =
    Boolean(publicUrl) &&
    Boolean(smtp.host) &&
    Boolean(smtp.port) &&
    Boolean(smtp.from);

  const langchainTracingRaw = await pick(
    SETTING_KEYS.langchainTracingV2,
    env.langchainTracingV2 ?? "false",
  );
  const langchainApiKey = await pick(
    SETTING_KEYS.langchainApiKey,
    env.langchainApiKey ?? "",
  );
  const langchainProject = await pick(
    SETTING_KEYS.langchainProject,
    env.langchainProject ?? "rx-workflow",
  );
  const langchain = {
    tracingV2: langchainTracingRaw === "true",
    apiKey: langchainApiKey,
    project: langchainProject,
    enabled: langchainTracingRaw === "true" && Boolean(langchainApiKey.trim()),
  };
  applyLangChainTracingEnv(langchain);

  return {
    publicUrl,
    smtp,
    ollamaUrl: await pick(SETTING_KEYS.ollamaUrl, env.ollamaUrl),
    ollamaModel: await pick(SETTING_KEYS.ollamaModel, env.ollamaModel),
    webhookSecret: await pick(SETTING_KEYS.webhookSecret, env.webhookSecret),
    brand: {
      productName: await pick(SETTING_KEYS.brandProductName, env.brandProductName ?? "RX-Workflow"),
      logoUrl: await pick(SETTING_KEYS.brandLogoUrl, env.brandLogoUrl ?? ""),
    },
    passwordResetEnabled,
    langchain,
  };
}
