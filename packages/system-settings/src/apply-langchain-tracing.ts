export interface LangChainTracingConfig {
  tracingV2: boolean;
  apiKey: string;
  project: string;
}

/** Sync LangSmith / LangChain tracing env vars for the current API process. */
export function applyLangChainTracingEnv(config: LangChainTracingConfig): void {
  const enabled = config.tracingV2 && Boolean(config.apiKey.trim());
  if (enabled) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_API_KEY = config.apiKey.trim();
    process.env.LANGCHAIN_PROJECT =
      config.project.trim() || process.env.LANGCHAIN_PROJECT || 'rx-workflow';
    return;
  }
  delete process.env.LANGCHAIN_TRACING_V2;
}
