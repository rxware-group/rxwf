import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "../repo-root.js";

export interface AwfSecrets {
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
  redisPassword: string;
}

const SECRETS_DIR = join(repoRoot, ".rxwf");
const SECRETS_FILE = join(SECRETS_DIR, "secrets.local.json");

function randomSecret(): string {
  return randomBytes(16).toString("hex");
}

export async function loadOrCreateSecrets(
  env: NodeJS.ProcessEnv,
): Promise<AwfSecrets> {
  const fromEnv: AwfSecrets = {
    postgresUser: env.RXWF_POSTGRES_USER ?? "rxwf",
    postgresPassword: env.RXWF_POSTGRES_PASSWORD ?? "",
    postgresDb: env.RXWF_POSTGRES_DB ?? "rxwf",
    redisPassword: env.RXWF_REDIS_PASSWORD ?? "",
  };

  if (fromEnv.postgresPassword && fromEnv.redisPassword) {
    return fromEnv;
  }

  try {
    const raw = await readFile(SECRETS_FILE, "utf8");
    const parsed = JSON.parse(raw) as AwfSecrets;
    if (parsed.postgresPassword && parsed.redisPassword) {
      return {
        postgresUser: parsed.postgresUser ?? "rxwf",
        postgresPassword: parsed.postgresPassword,
        postgresDb: parsed.postgresDb ?? "rxwf",
        redisPassword: parsed.redisPassword,
      };
    }
  } catch {
    // generate below
  }

  const created: AwfSecrets = {
    postgresUser: fromEnv.postgresUser,
    postgresPassword: fromEnv.postgresPassword || randomSecret(),
    postgresDb: fromEnv.postgresDb,
    redisPassword: fromEnv.redisPassword || randomSecret(),
  };

  await mkdir(SECRETS_DIR, { recursive: true });
  await writeFile(SECRETS_FILE, JSON.stringify(created, null, 2), "utf8");
  return created;
}

export function secretsToComposeEnv(secrets: AwfSecrets): NodeJS.ProcessEnv {
  return {
    RXWF_POSTGRES_USER: secrets.postgresUser,
    RXWF_POSTGRES_PASSWORD: secrets.postgresPassword,
    RXWF_POSTGRES_DB: secrets.postgresDb,
    RXWF_REDIS_PASSWORD: secrets.redisPassword,
  };
}
