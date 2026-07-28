import type { RunnerGatewayPort } from "@rxwf/providers-contracts";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { createLiteRunnerRepository } from "@rxwf/providers-lite";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_STALE_MS = 90_000;

export type RunnerOfflineSweeperDeps = {
  db: LiteDatabase;
  gateway: RunnerGatewayPort;
  intervalMs?: number;
  staleMs?: number;
  now?: () => number;
};

export async function runRunnerOfflineSweepOnce(
  deps: RunnerOfflineSweeperDeps,
): Promise<void> {
  const runnerRepo = createLiteRunnerRepository(deps.db);
  const staleMs = deps.staleMs ?? DEFAULT_STALE_MS;
  const now = deps.now?.() ?? Date.now();
  const cutoff = now - staleMs;

  const onlineAgents = await runnerRepo.listOnline({ kind: "agent" });

  for (const runner of onlineAgents) {
    const lastHeartbeat = runner.lastHeartbeatAt?.getTime();
    if (lastHeartbeat !== undefined && lastHeartbeat >= cutoff) {
      continue;
    }

    if (deps.gateway.isConnected(runner.id)) {
      deps.gateway.kickConnection(runner.id, "Heartbeat stale");
    }
    await runnerRepo.setStatus(runner.id, "offline");
  }
}

export function startRunnerOfflineSweeper(
  deps: RunnerOfflineSweeperDeps,
): () => void {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;

  const runOnce = () => {
    void runRunnerOfflineSweepOnce(deps).catch((err) => {
      console.error("[runners] offline sweep failed", err);
    });
  };

  void runRunnerOfflineSweepOnce(deps).catch((err) => {
    console.error("[runners] offline sweep failed", err);
  });

  const timer = setInterval(runOnce, intervalMs);

  return () => clearInterval(timer);
}
