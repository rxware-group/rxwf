import type { DepPlan, RuntimeBootstrapConfig } from "../types.js";

export function planDeps(cfg: RuntimeBootstrapConfig): DepPlan {
  if (cfg.mode === "lite") {
    return { needRedis: false, needPostgres: false };
  }
  return {
    needRedis: !cfg.redisUrl,
    needPostgres: !cfg.postgresUrl,
  };
}
