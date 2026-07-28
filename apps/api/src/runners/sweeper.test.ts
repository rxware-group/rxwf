import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  createLiteRunnerRepository,
  createTestDb,
  liteSchema,
} from "@rxwf/providers-lite";
import { createInMemoryRunnerGateway } from "./runner-gateway.js";
import { runRunnerOfflineSweepOnce } from "./sweeper.js";

function hashCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

describe("runRunnerOfflineSweepOnce", () => {
  it("marks stale online agent offline", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "stale-worker",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.setStatus(agent.id, "online");
    const staleAt = new Date(Date.now() - 120_000);
    await db
      .update(liteSchema.runners)
      .set({ lastHeartbeatAt: staleAt })
      .where(eq(liteSchema.runners.id, agent.id));

    const gateway = createInMemoryRunnerGateway();
    const now = Date.now();

    await runRunnerOfflineSweepOnce({
      db,
      gateway,
      staleMs: 90_000,
      now: () => now,
    });

    const updated = await repo.findById(agent.id);
    expect(updated?.status).toBe("offline");
  });

  it("kicks connected stale agent", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "connected-stale",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.setStatus(agent.id, "online");
    const staleAt = new Date(Date.now() - 120_000);
    await db
      .update(liteSchema.runners)
      .set({ lastHeartbeatAt: staleAt })
      .where(eq(liteSchema.runners.id, agent.id));

    const gateway = createInMemoryRunnerGateway();
    const close = vi.fn();
    gateway.registerConnection(agent.id, {
      send: () => {},
      close,
    });

    await runRunnerOfflineSweepOnce({
      db,
      gateway,
      staleMs: 90_000,
    });

    expect(close).toHaveBeenCalled();
    expect(gateway.isConnected(agent.id)).toBe(false);
  });

  it("leaves fresh heartbeat online", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "fresh-worker",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.setStatus(agent.id, "online");
    await repo.updatePresence(agent.id, 1);

    const gateway = createInMemoryRunnerGateway();

    await runRunnerOfflineSweepOnce({
      db,
      gateway,
      staleMs: 90_000,
    });

    const updated = await repo.findById(agent.id);
    expect(updated?.status).toBe("online");
  });
});
