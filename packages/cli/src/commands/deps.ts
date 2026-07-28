import { Command } from "commander";
import { StartupError } from "../errors.js";
import { resolveConfig } from "../config/resolve-config.js";
import {
  buildPostgresUrl,
  buildRedisUrl,
  depsDown,
  depsLogs,
  depsStatus,
  ensureCrewAiRunner,
  ensureServices,
  loadPortMappingOrDefaults,
} from "../infra/docker-manager.js";
import { maskUrl } from "../infra/mask-url.js";
import { loadOrCreateSecrets } from "../infra/secrets-store.js";

function parseServices(raw?: string): {
  needRedis: boolean;
  needPostgres: boolean;
  needCrewai: boolean;
} {
  if (!raw) {
    return { needRedis: true, needPostgres: true, needCrewai: false };
  }
  const parts = raw.split(",").map((s) => s.trim().toLowerCase());
  return {
    needRedis: parts.includes("redis"),
    needPostgres: parts.includes("postgres"),
    needCrewai: parts.includes("crewai"),
  };
}

function composeFilesForDeps(
  standardFile: string,
  crewaiOverlayFile: string,
  includeCrewai: boolean,
): string[] {
  if (includeCrewai) {
    return [standardFile, crewaiOverlayFile];
  }
  return [standardFile];
}

export function registerDepsCommand(program: Command): void {
  const deps = program
    .command("deps")
    .description("Manage local Redis/PostgreSQL/CrewAI dependencies (Docker)");

  deps
    .command("up")
    .description("Start dependency containers")
    .option("--services <list>", "redis,postgres,crewai subset")
    .option("--auto-port", "Bind to free host ports on 127.0.0.1")
    .option("--docker-compose-file <path>", "Compose file path")
    .action(async (opts) => {
      try {
        const cfg = resolveConfig(
          { mode: "standard", dockerComposeFile: opts.dockerComposeFile },
          process.env,
        );
        const { needRedis, needPostgres, needCrewai } = parseServices(
          opts.services,
        );
        const secrets = await loadOrCreateSecrets(process.env);

        if (needRedis || needPostgres) {
          const mapping = await ensureServices({
            composeFile: cfg.dockerComposeFile,
            needRedis,
            needPostgres,
            secrets,
            autoPort: Boolean(opts.autoPort),
          });
          console.log("Dependencies started.");
          if (needPostgres) {
            console.log(
              `  postgres: ${maskUrl(buildPostgresUrl(secrets, mapping.postgresHostPort))}`,
            );
          }
          if (needRedis) {
            console.log(
              `  redis: ${maskUrl(buildRedisUrl(secrets, mapping.redisHostPort))}`,
            );
          }
        }

        if (needCrewai) {
          const { url } = await ensureCrewAiRunner({
            standardComposeFile: cfg.dockerComposeFile,
            crewaiOverlayFile: cfg.crewaiOverlayFile,
            portBinding: cfg.crewaiPortBinding,
            timeoutSec: cfg.startupTimeoutSec,
            image: cfg.crewaiImage,
          });
          console.log("Dependencies started.");
          console.log(`  crewai-runner: ${url}`);
        }
      } catch (err) {
        handleCliError(err);
      }
    });

  deps
    .command("down")
    .description("Stop dependency containers")
    .option("--docker-compose-file <path>", "Compose file path")
    .option("--with-crewai", "Also tear down crewai-runner in compose project")
    .action(async (opts) => {
      try {
        const cfg = resolveConfig(
          { mode: "standard", dockerComposeFile: opts.dockerComposeFile },
          process.env,
        );
        const files = composeFilesForDeps(
          cfg.dockerComposeFile,
          cfg.crewaiOverlayFile,
          Boolean(opts.withCrewai),
        );
        await depsDown(files);
        console.log("Dependencies stopped.");
      } catch (err) {
        handleCliError(err);
      }
    });

  deps
    .command("status")
    .description("Show dependency container status")
    .option("--docker-compose-file <path>", "Compose file path")
    .option("--with-crewai", "Include crewai-runner overlay in compose ps")
    .action(async (opts) => {
      try {
        const cfg = resolveConfig(
          { mode: "standard", dockerComposeFile: opts.dockerComposeFile },
          process.env,
        );
        const files = composeFilesForDeps(
          cfg.dockerComposeFile,
          cfg.crewaiOverlayFile,
          Boolean(opts.withCrewai),
        );
        const out = await depsStatus(files);
        console.log(out);
        const secrets = await loadOrCreateSecrets(process.env);
        const mapping = await loadPortMappingOrDefaults();
        console.log("\nSuggested URLs (masked):");
        console.log(
          `  postgres: ${maskUrl(buildPostgresUrl(secrets, mapping.postgresHostPort))}`,
        );
        console.log(
          `  redis: ${maskUrl(buildRedisUrl(secrets, mapping.redisHostPort))}`,
        );
        if (opts.withCrewai && cfg.crewaiUrl) {
          console.log(`  crewai-runner: ${cfg.crewaiUrl}`);
        }
      } catch (err) {
        handleCliError(err);
      }
    });

  deps
    .command("logs")
    .description("Tail dependency logs")
    .option("--service <name>", "redis, postgres, or crewai-runner")
    .option("--docker-compose-file <path>", "Compose file path")
    .option("--with-crewai", "Include crewai-runner overlay when resolving service")
    .action(async (opts) => {
      try {
        const cfg = resolveConfig(
          { mode: "standard", dockerComposeFile: opts.dockerComposeFile },
          process.env,
        );
        const files = composeFilesForDeps(
          cfg.dockerComposeFile,
          cfg.crewaiOverlayFile,
          Boolean(opts.withCrewai) || opts.service === "crewai-runner",
        );
        await depsLogs(files, opts.service);
      } catch (err) {
        handleCliError(err);
      }
    });
}

function handleCliError(err: unknown): never {
  if (err instanceof StartupError) {
    console.error(`[${err.code}] ${err.message}`);
  } else if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(String(err));
  }
  process.exit(1);
}
