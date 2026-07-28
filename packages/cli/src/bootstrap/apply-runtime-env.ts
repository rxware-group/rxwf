import type { RuntimeBootstrapConfig } from "../types.js";

export function applyRuntimeEnv(cfg: RuntimeBootstrapConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RXWF_DEPLOY_PROFILE: cfg.deployProfile,
  };

  if (cfg.crewaiRunnerUrl) {
    env.CREWAI_RUNNER_URL = cfg.crewaiRunnerUrl;
  }

  if (cfg.mode === "lite") {
    env.RXWF_SQLITE_PATH = cfg.sqlitePath;
    return env;
  }

  if (cfg.postgresUrl) {
    env.RXWF_DATABASE_URL = cfg.postgresUrl;
  }
  if (cfg.redisUrl) {
    env.RXWF_REDIS_URL = cfg.redisUrl;
  }
  return env;
}
