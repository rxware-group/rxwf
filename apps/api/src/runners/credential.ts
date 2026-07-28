import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRunnerCredential(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRunnerCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

export function verifyRunnerCredential(
  credential: string,
  storedHash: string,
): boolean {
  const computed = hashRunnerCredential(credential);
  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
