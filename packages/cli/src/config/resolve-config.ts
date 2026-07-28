import { join } from "node:path";
import { repoRoot } from "../repo-root.js";
import type { RuntimeBootstrapConfig, StartArgs } from "../types.js";

const DEFAULT_COMPOSE = join(
  repoRoot,
  "deploy",
  "docker-compose.standard.yml",
);

const DEFAULT_CREWAI_OVERLAY = join(
  repoRoot,
  "deploy",
  "docker-compose.crewai.yml",
);

const DEFAULT_SQLITE_REL = join("data", "rxwf.db");

const DEFAULT_CREWAI_PORT_BINDING = "127.0.0.1:8071:8071";

export function resolveCrewAiPortBinding(env: NodeJS.ProcessEnv): string {
  return env.RXWF_CREWAI_PORT?.trim() || DEFAULT_CREWAI_PORT_BINDING;
}

export function resolveConfig(
  args: StartArgs,
  env: NodeJS.ProcessEnv,
): RuntimeBootstrapConfig {
  const mode = args.mode ?? "lite";

  const postgresUrl =
    args.postgresUrl ??
    env.RXWF_DATABASE_URL ??
    env.RXWF_POSTGRES_URL ??
    undefined;

  const redisUrl = args.redisUrl ?? env.RXWF_REDIS_URL ?? undefined;

  const sqlitePath =
    args.sqlitePath ??
    env.RXWF_SQLITE_PATH ??
    join(repoRoot, DEFAULT_SQLITE_REL);

  const crewaiUrl =
    args.crewaiUrl?.trim() ||
    env.CREWAI_RUNNER_URL?.trim() ||
    undefined;

  return {
    mode,
    deployProfile: mode,
    postgresUrl,
    redisUrl,
    sqlitePath,
    noDockerAuto: args.noDockerAuto ?? false,
    autoPort: args.autoPort ?? false,
    withWeb: args.withWeb ?? false,
    withCrewai: args.withCrewai ?? false,
    crewaiUrl,
    crewaiPortBinding: resolveCrewAiPortBinding(env),
    crewaiOverlayFile: DEFAULT_CREWAI_OVERLAY,
    crewaiImage: env.RXWF_CREWAI_IMAGE?.trim() || undefined,
    depsLifecycle: args.depsLifecycle ?? "keep",
    startupTimeoutSec: args.startupTimeoutSec ?? 60,
    dockerComposeFile: args.dockerComposeFile ?? DEFAULT_COMPOSE,
  };
}
