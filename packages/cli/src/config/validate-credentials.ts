import { StartupError } from "../errors.js";

export interface StandardCredentialUrls {
  postgresUrl: string;
  redisUrl: string;
}

export function validateStandardCredentials(urls: StandardCredentialUrls): void {
  validatePostgresUrl(urls.postgresUrl);
  validateRedisUrl(urls.redisUrl);
}

function validatePostgresUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new StartupError(
      "AWF-START-007",
      `Invalid PostgreSQL URL: ${url}`,
    );
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new StartupError(
      "AWF-START-007",
      "PostgreSQL URL must use postgres:// or postgresql:// scheme",
    );
  }
  if (!parsed.username) {
    throw new StartupError(
      "AWF-START-007",
      "PostgreSQL URL must include a username",
    );
  }
  if (!parsed.password) {
    throw new StartupError(
      "AWF-START-007",
      "PostgreSQL URL must include a password",
    );
  }
}

function validateRedisUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new StartupError("AWF-START-007", `Invalid Redis URL: ${url}`);
  }
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new StartupError(
      "AWF-START-007",
      "Redis URL must use redis:// or rediss:// scheme",
    );
  }
  const hasPassword = Boolean(parsed.password);
  const hasUserPassword = Boolean(parsed.username && parsed.password);
  if (!hasPassword && !hasUserPassword) {
    throw new StartupError(
      "AWF-START-007",
      "Redis URL must include a password (redis://:password@host:port/db)",
    );
  }
}
