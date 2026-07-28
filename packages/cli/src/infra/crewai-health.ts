import { StartupError } from "../errors.js";

export function parseCrewAiHostPort(portBinding: string): number {
  const binding = portBinding.trim();
  const parts = binding.split(":");
  if (parts.length >= 3) {
    const hostPort = Number(parts[parts.length - 2]);
    if (!Number.isFinite(hostPort) || hostPort <= 0) {
      throw new Error(`Invalid RXWF_CREWAI_PORT binding: ${portBinding}`);
    }
    return hostPort;
  }
  if (parts.length === 2) {
    const hostPort = Number(parts[0]);
    if (!Number.isFinite(hostPort) || hostPort <= 0) {
      throw new Error(`Invalid RXWF_CREWAI_PORT binding: ${portBinding}`);
    }
    return hostPort;
  }
  const hostPort = Number(parts[0]);
  if (!Number.isFinite(hostPort) || hostPort <= 0) {
    throw new Error(`Invalid RXWF_CREWAI_PORT binding: ${portBinding}`);
  }
  return hostPort;
}

export function buildLocalCrewAiUrl(hostPort: number): string {
  return `http://127.0.0.1:${hostPort}`;
}

export async function probeCrewAiHealth(
  baseUrl: string,
  timeoutSec: number,
): Promise<void> {
  const healthUrl = `${baseUrl.replace(/\/$/, "")}/health`;
  const deadline = Date.now() + timeoutSec * 1000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = (await res.json()) as { status?: string };
        if (body.status === "ok") return;
      }
    } catch {
      // retry until deadline
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new StartupError(
    "AWF-START-008",
    `CrewAI runner health check timed out after ${timeoutSec}s (${healthUrl})`,
  );
}
