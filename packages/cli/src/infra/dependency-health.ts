import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StartupError } from "../errors.js";
import type { AwfSecrets } from "./secrets-store.js";
import { COMPOSE_PROJECT } from "./docker-manager.js";
import { repoRoot } from "../repo-root.js";

const execFileAsync = promisify(execFile);

export interface HealthTargets {
  checkPostgres: boolean;
  checkRedis: boolean;
}

async function composeExec(
  composeFile: string,
  service: string,
  command: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await execFileAsync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "-p",
      COMPOSE_PROJECT,
      "exec",
      "-T",
      service,
      ...command,
    ],
    { cwd: repoRoot, env: { ...process.env, ...env }, maxBuffer: 1024 * 1024 },
  );
}

export async function waitForHealthy(
  options: {
    composeFile: string;
    targets: HealthTargets;
    secrets: AwfSecrets;
    timeoutSec: number;
  },
): Promise<void> {
  const deadline = Date.now() + options.timeoutSec * 1000;
  const env: NodeJS.ProcessEnv = {
    RXWF_POSTGRES_USER: options.secrets.postgresUser,
    RXWF_POSTGRES_PASSWORD: options.secrets.postgresPassword,
    RXWF_POSTGRES_DB: options.secrets.postgresDb,
    RXWF_REDIS_PASSWORD: options.secrets.redisPassword,
  };

  while (Date.now() < deadline) {
    let ok = true;
    if (options.targets.checkPostgres) {
      try {
        await composeExec(
          options.composeFile,
          "postgres",
          [
            "pg_isready",
            "-U",
            options.secrets.postgresUser,
            "-d",
            options.secrets.postgresDb,
          ],
          env,
        );
      } catch {
        ok = false;
      }
    }
    if (options.targets.checkRedis) {
      try {
        await composeExec(
          options.composeFile,
          "redis",
          ["redis-cli", "-a", options.secrets.redisPassword, "ping"],
          env,
        );
      } catch {
        ok = false;
      }
    }
    if (ok) return;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (options.targets.checkPostgres) {
    throw new StartupError(
      "AWF-START-004",
      `PostgreSQL health check timed out after ${options.timeoutSec}s`,
    );
  }
  throw new StartupError(
    "AWF-START-005",
    `Redis health check timed out after ${options.timeoutSec}s`,
  );
}
