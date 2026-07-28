export const SETTING_KEYS = {
  publicUrl: "publicUrl",
  smtpHost: "smtp.host",
  smtpPort: "smtp.port",
  smtpSecure: "smtp.secure",
  smtpUser: "smtp.user",
  smtpPassword: "smtp.password",
  smtpFrom: "smtp.from",
  ollamaUrl: "ollamaUrl",
  ollamaModel: "ollamaModel",
  webhookSecret: "webhookSecret",
  brandLogoUrl: "brand.logoUrl",
  brandProductName: "brand.productName",
  langchainTracingV2: "langchain.tracingV2",
  langchainApiKey: "langchain.apiKey",
  langchainProject: "langchain.project",
  rxwfWorkspaceRoot: "rxwf.workspaceRoot",
  webSearchConfig: "webSearch.config",
  knowledgeConfig: "knowledge.config",
} as const;

export const SENSITIVE_KEYS = new Set<string>([
  SETTING_KEYS.smtpPassword,
  SETTING_KEYS.webhookSecret,
  SETTING_KEYS.langchainApiKey,
]);

export const MASK = "***";
