import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { StartupError } from "../errors.js";
import { repoRoot } from "../repo-root.js";
import type { AwfSecrets } from "./secrets-store.js";
import {
  buildLocalCrewAiUrl,
  parseCrewAiHostPort,
  probeCrewAiHealth,
} from "./crewai-health.js";
import {
  formatPortBinding,
  resolveAutoPorts,
} from "./port-resolver.js";

const execFileAsync = promisify(execFile);

export const COMPOSE_PROJECT = "rxwf-standard";
const RXWF_DIR = join(repoRoot, ".rxwf");
const OVERRIDE_FILE = join(RXWF_DIR, "compose.override.yml");
const PORTS_FILE = join(RXWF_DIR, "ports.json");

export interface PortMapping {
  postgresHostPort: number;
  redisHostPort: number;
}

export interface EnsureServicesOptions {
  composeFile: string;
  needRedis: boolean;
  needPostgres: boolean;
  secrets: AwfSecrets;
  autoPort: boolean;
}

export interface EnsureCrewAiRunnerOptions {
  standardComposeFile: string;
  crewaiOverlayFile: string;
  portBinding: string;
  timeoutSec: number;
  image?: string;
}

async function runDockerCompose(
  composeFiles: string[],
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<string> {
  const files = [...composeFiles];
  try {
    const { access } = await import("node:fs/promises");
    await access(OVERRIDE_FILE);
    files.push(OVERRIDE_FILE);
  } catch {
    // no override
  }

  const fileArgs = files.flatMap((f) => ["-f", f]);
  const { stdout } = await execFileAsync(
    "docker",
    ["compose", ...fileArgs, "-p", COMPOSE_PROJECT, ...args],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout.toString();
}

export async function assertDockerAvailable(): Promise<void> {
  try {
    await execFileAsync("docker", ["version"], { maxBuffer: 1024 * 1024 });
  } catch {
    throw new StartupError(
      "AWF-START-002",
      "Docker is not available. Install Docker, use --lite, or provide --redis-url and --postgres-url.",
    );
  }
  try {
    await execFileAsync("docker", ["compose", "version"], {
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new StartupError(
      "AWF-START-003",
      "Docker Compose v2 is not available (docker compose).",
    );
  }
}

async function writePortBindings(
  autoPort: boolean,
  env: NodeJS.ProcessEnv,
): Promise<PortMapping> {
  let postgresHostPort = 5432;
  let redisHostPort = 6379;

  if (autoPort) {
    const ports = await resolveAutoPorts();
    postgresHostPort = ports.postgresHostPort;
    redisHostPort = ports.redisHostPort;
    await mkdir(RXWF_DIR, { recursive: true });
    const override = `services:
  postgres:
    ports:
      - "${formatPortBinding(postgresHostPort, 5432)}"
  redis:
    ports:
      - "${formatPortBinding(redisHostPort, 6379)}"
`;
    await writeFile(OVERRIDE_FILE, override, "utf8");
    env.RXWF_POSTGRES_PORT = formatPortBinding(postgresHostPort, 5432);
    env.RXWF_REDIS_PORT = formatPortBinding(redisHostPort, 6379);
  } else {
    env.RXWF_POSTGRES_PORT ??= formatPortBinding(5432, 5432);
    env.RXWF_REDIS_PORT ??= formatPortBinding(6379, 6379);
  }

  const mapping: PortMapping = { postgresHostPort, redisHostPort };
  await mkdir(RXWF_DIR, { recursive: true });
  await writeFile(PORTS_FILE, JSON.stringify(mapping, null, 2), "utf8");
  return mapping;
}

export async function ensureServices(
  options: EnsureServicesOptions,
): Promise<PortMapping> {
  await assertDockerAvailable();

  const services: string[] = [];
  if (options.needPostgres) services.push("postgres");
  if (options.needRedis) services.push("redis");
  if (services.length === 0) {
    return loadPortMappingOrDefaults();
  }

  const env: NodeJS.ProcessEnv = {
    RXWF_POSTGRES_USER: options.secrets.postgresUser,
    RXWF_POSTGRES_PASSWORD: options.secrets.postgresPassword,
    RXWF_POSTGRES_DB: options.secrets.postgresDb,
    RXWF_REDIS_PASSWORD: options.secrets.redisPassword,
  };

  const mapping = await writePortBindings(options.autoPort, env);

  try {
    await runDockerCompose([options.composeFile], ["up", "-d", ...services], env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new StartupError(
      "AWF-START-006",
      `Failed to start dependency containers: ${message}`,
    );
  }

  return mapping;
}

export async function ensureCrewAiRunner(
  options: EnsureCrewAiRunnerOptions,
): Promise<{ url: string }> {
  await assertDockerAvailable();

  const env: NodeJS.ProcessEnv = {
    RXWF_CREWAI_PORT: options.portBinding,
  };
  if (options.image) {
    env.RXWF_CREWAI_IMAGE = options.image;
  }

  const composeFiles = [
    options.standardComposeFile,
    options.crewaiOverlayFile,
  ];

  try {
    await runDockerCompose(composeFiles, ["up", "-d", "crewai-runner"], env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new StartupError(
      "AWF-START-008",
      `Failed to start crewai-runner container: ${message}`,
    );
  }

  const hostPort = parseCrewAiHostPort(options.portBinding);
  const url = buildLocalCrewAiUrl(hostPort);
  await probeCrewAiHealth(url, options.timeoutSec);
  return { url };
}

export async function loadPortMappingOrDefaults(): Promise<PortMapping> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(PORTS_FILE, "utf8");
    return JSON.parse(raw) as PortMapping;
  } catch {
    return { postgresHostPort: 5432, redisHostPort: 6379 };
  }
}

export function buildPostgresUrl(
  secrets: AwfSecrets,
  hostPort: number,
): string {
  const user = encodeURIComponent(secrets.postgresUser);
  const pass = encodeURIComponent(secrets.postgresPassword);
  const db = encodeURIComponent(secrets.postgresDb);
  return `postgres://${user}:${pass}@127.0.0.1:${hostPort}/${db}`;
}

export function buildRedisUrl(secrets: AwfSecrets, hostPort: number): string {
  const pass = encodeURIComponent(secrets.redisPassword);
  return `redis://:${pass}@127.0.0.1:${hostPort}/0`;
}

export async function depsDown(composeFiles: string | string[]): Promise<void> {
  await assertDockerAvailable();
  const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
  await runDockerCompose(files, ["down"], process.env);
}

export async function depsStatus(composeFiles: string | string[]): Promise<string> {
  await assertDockerAvailable();
  const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
  return runDockerCompose(files, ["ps"], process.env);
}

export async function depsLogs(
  composeFiles: string | string[],
  service?: string,
): Promise<void> {
  await assertDockerAvailable();
  const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
  const args = ["logs", "--tail", "100"];
  if (service) args.push(service);
  const out = await runDockerCompose(files, args, process.env);
  process.stdout.write(out);
}
