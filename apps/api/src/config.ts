import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Monorepo root `data/` — same path as `pnpm reset:data` when cwd is repo root */
const defaultDataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "data",
);

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

export const config = {
  httpPort: Number(process.env.RXWF_HTTP_PORT ?? 8787),
  dataDir: process.env.RXWF_DATA_DIR ?? defaultDataDir,
  deployProfile: process.env.RXWF_DEPLOY_PROFILE ?? "lite",
  /** @deprecated Plus 门控已移除；恒为 true，保留字段供 API 兼容 */
  featurePlus: true as const,
  schedulerTickMs: Number(process.env.RXWF_SCHEDULER_TICK_MS ?? 60_000),
  schedulerDisabled: process.env.RXWF_SCHEDULER_DISABLED === "true",
  jobProcessorTickMs: Number(process.env.RXWF_JOB_TICK_MS ?? 5_000),
  jobProcessorDisabled: process.env.RXWF_JOB_PROCESSOR_DISABLED === "true",
  jobProcessorMetrics: process.env.RXWF_JOB_PROCESSOR_METRICS === "true",
  /** 32-byte AES key as 64 hex chars; dev default for Lite only */
  credentialKey:
    process.env.RXWF_CREDENTIAL_KEY ??
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  pluginSigningSecret: process.env.RXWF_PLUGIN_SECRET ?? "dev-plugin-secret",
  /** HMAC secret for crew tool bridge tokens (sidecar → api internal route) */
  crewToolBridgeSecret:
    process.env.RXWF_CREW_TOOL_BRIDGE_SECRET ??
    process.env.RXWF_WEBHOOK_SECRET ??
    "dev-webhook-secret",
  databaseUrl:
    process.env.RXWF_DATABASE_URL ??
    process.env.RXWF_POSTGRES_URL ??
    "postgres://rxwf:rxwf@localhost:5432/rxwf",
  redisUrl: process.env.RXWF_REDIS_URL ?? "redis://localhost:6379",
  bullmqExecutionConcurrency: readPositiveInt("RXWF_BULLMQ_EXECUTION_CONCURRENCY", 4),
  bullmqKnowledgeConcurrency: readPositiveInt("RXWF_BULLMQ_KNOWLEDGE_CONCURRENCY", 2),
  liteJobConcurrency: readPositiveInt("RXWF_LITE_JOB_CONCURRENCY", 4),
  /** Comma-separated CrewAI builtin tool whitelist for E1041 validation */
  crewaiAllowedBuiltinTools: (process.env.CREWAI_ALLOWED_BUILTIN_TOOLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

/** 可迁移至 system_settings 的环境变量默认值 */
export const envDefaults = {
  publicUrl: process.env.RXWF_PUBLIC_URL ?? "http://localhost:8787",
  smtpHost: process.env.RXWF_SMTP_HOST,
  smtpPort: process.env.RXWF_SMTP_PORT,
  smtpSecure: process.env.RXWF_SMTP_SECURE,
  smtpUser: process.env.RXWF_SMTP_USER,
  smtpPassword: process.env.RXWF_SMTP_PASSWORD,
  smtpFrom: process.env.RXWF_SMTP_FROM,
  ollamaUrl: process.env.RXWF_OLLAMA_URL ?? "http://127.0.0.1:11434",
  ollamaModel: process.env.RXWF_OLLAMA_MODEL ?? "llama3",
  webhookSecret: process.env.RXWF_WEBHOOK_SECRET ?? "dev-webhook-secret",
  brandProductName: process.env.RXWF_BRAND_NAME,
  brandLogoUrl: process.env.RXWF_BRAND_LOGO_URL,
  langchainTracingV2: process.env.LANGCHAIN_TRACING_V2,
  langchainApiKey: process.env.LANGCHAIN_API_KEY,
  langchainProject: process.env.LANGCHAIN_PROJECT,
} as const;
