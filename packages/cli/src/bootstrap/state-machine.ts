import { StartupError } from "../errors.js";
import { planDeps } from "./plan-deps.js";
import { bootDevStack } from "./boot-dev-stack.js";
import { prepareCrewAiSidecar } from "./prepare-crewai.js";
import { resolveConfig } from "../config/resolve-config.js";
import { validateStandardCredentials } from "../config/validate-credentials.js";
import {
  buildPostgresUrl,
  buildRedisUrl,
  depsDown,
  ensureServices,
  loadPortMappingOrDefaults,
} from "../infra/docker-manager.js";
import { waitForHealthy } from "../infra/dependency-health.js";
import { maskUrl } from "../infra/mask-url.js";
import { loadOrCreateSecrets } from "../infra/secrets-store.js";
import type { StartArgs, RuntimeBootstrapConfig } from "../types.js";

export interface StartRunResult {
  exitCode: number;
}

async function prepareStandardConfig(
  cfg: RuntimeBootstrapConfig,
): Promise<{ cfg: RuntimeBootstrapConfig; dockerStarted: boolean }> {
  const plan = planDeps(cfg);
  const needsDocker = plan.needRedis || plan.needPostgres;
  let dockerStarted = false;

  if (needsDocker && cfg.noDockerAuto) {
    throw new StartupError(
      "AWF-START-001",
      "Standard mode is missing dependency URLs and --no-docker-auto is set. " +
        "Provide --redis-url and --postgres-url, or remove --no-docker-auto.",
    );
  }

  if (needsDocker) {
    const loaded = await loadOrCreateSecrets(process.env);
    const mapping = await ensureServices({
      composeFile: cfg.dockerComposeFile,
      needRedis: plan.needRedis,
      needPostgres: plan.needPostgres,
      secrets: loaded,
      autoPort: cfg.autoPort,
    });
    dockerStarted = true;

    await waitForHealthy({
      composeFile: cfg.dockerComposeFile,
      targets: {
        checkPostgres: plan.needPostgres,
        checkRedis: plan.needRedis,
      },
      secrets: loaded,
      timeoutSec: cfg.startupTimeoutSec,
    });

    if (plan.needPostgres && !cfg.postgresUrl) {
      cfg.postgresUrl = buildPostgresUrl(loaded, mapping.postgresHostPort);
    }
    if (plan.needRedis && !cfg.redisUrl) {
      cfg.redisUrl = buildRedisUrl(loaded, mapping.redisHostPort);
    }
  } else {
    await loadPortMappingOrDefaults();
  }

  if (!cfg.postgresUrl || !cfg.redisUrl) {
    throw new StartupError(
      "AWF-START-001",
      "Standard mode requires both PostgreSQL and Redis connection URLs.",
    );
  }

  validateStandardCredentials({
    postgresUrl: cfg.postgresUrl,
    redisUrl: cfg.redisUrl,
  });

  console.log(
    `Starting standard mode — postgres: ${maskUrl(cfg.postgresUrl)} redis: ${maskUrl(cfg.redisUrl)}`,
  );

  return { cfg, dockerStarted };
}

export async function runStart(args: StartArgs): Promise<StartRunResult> {
  let cfg = resolveConfig(args, process.env);
  let dockerStarted = false;
  let crewaiDockerDeployed = false;

  try {
    if (cfg.mode === "standard") {
      const prepared = await prepareStandardConfig(cfg);
      cfg = prepared.cfg;
      dockerStarted = prepared.dockerStarted;
    }

    if (cfg.withCrewai) {
      const crewai = await prepareCrewAiSidecar(cfg);
      cfg = crewai.cfg;
      crewaiDockerDeployed = crewai.dockerDeployed;
      console.log(`CrewAI runner: ${cfg.crewaiRunnerUrl}`);
    }

    return await bootDevStack(cfg);
  } finally {
    if (cfg.depsLifecycle === "down" && (dockerStarted || crewaiDockerDeployed)) {
      try {
        const files = crewaiDockerDeployed
          ? [cfg.dockerComposeFile, cfg.crewaiOverlayFile]
          : [cfg.dockerComposeFile];
        await depsDown(files);
      } catch (err) {
        console.error("Failed to tear down dependencies:", err);
      }
    }
  }
}
