import { createHash, randomBytes, scryptSync } from "node:crypto";

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  return derived === hash;
}

export function generateApiKeyPlaintext(): string {
  return `awf_${randomBytes(32).toString("base64url")}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
