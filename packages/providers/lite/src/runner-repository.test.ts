import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { createLiteRunnerRepository } from "./runner-repository.js";
import { createTestDb } from "./test-db.js";

function hashCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

describe("LiteRunnerRepository", () => {
  it("ensureEmbedded creates single embedded runner", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const r1 = await repo.ensureEmbedded(
      { os: "linux", arch: "x64" },
      ["code"],
    );
    const r2 = await repo.ensureEmbedded(
      { os: "linux", arch: "x64" },
      ["code"],
    );
    expect(r1.id).toBe(r2.id);
    expect(r1.kind).toBe("embedded");
    expect(r1.capabilities).toContain("code");
  });

  it("registerAgent creates agent offline", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const credential = "test-credential-secret";
    const agent = await repo.registerAgent(
      {
        name: "worker-1",
        platform: { os: "linux", arch: "x64", osVersion: "22.04" },
        labels: ["gpu", "prod"],
        capabilities: ["code", "browser"],
        maxConcurrent: 4,
        agentVersion: "1.0.0",
      },
      hashCredential(credential),
    );

    expect(agent.kind).toBe("agent");
    expect(agent.status).toBe("offline");
    expect(agent.name).toBe("worker-1");
    expect(agent.platform).toEqual({
      os: "linux",
      arch: "x64",
      osVersion: "22.04",
    });
    expect(agent.labels).toEqual(["gpu", "prod"]);
    expect(agent.capabilities).toEqual(["code", "browser"]);
    expect(agent.maxConcurrent).toBe(4);
    expect(agent.runningJobs).toBe(0);
    expect(agent.agentVersion).toBe("1.0.0");
    expect(agent.lastHeartbeatAt).toBeUndefined();
  });

  it("registerAgent uses default maxConcurrent of 2", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "worker-default",
        platform: { os: "windows", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    expect(agent.maxConcurrent).toBe(2);
  });

  it("verifyCredential returns true for matching credential and false otherwise", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const credential = "valid-runner-credential";
    const agent = await repo.registerAgent(
      {
        name: "worker-auth",
        platform: { os: "macos", arch: "arm64" },
        capabilities: ["code"],
      },
      hashCredential(credential),
    );

    expect(await repo.verifyCredential(agent.id, credential)).toBe(true);
    expect(await repo.verifyCredential(agent.id, "wrong-credential")).toBe(
      false,
    );
    expect(await repo.verifyCredential("missing-id", credential)).toBe(false);
  });

  it("setStatus updates runner status", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "worker-status",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.setStatus(agent.id, "online");
    const updated = await repo.findById(agent.id);
    expect(updated?.status).toBe("online");

    await repo.setStatus(agent.id, "draining");
    const draining = await repo.findById(agent.id);
    expect(draining?.status).toBe("draining");
  });

  it("updatePresence updates runningJobs and lastHeartbeatAt", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const agent = await repo.registerAgent(
      {
        name: "worker-presence",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.updatePresence(agent.id, 3);
    const updated = await repo.findById(agent.id);
    expect(updated?.runningJobs).toBe(3);
    expect(updated?.lastHeartbeatAt).toBeInstanceOf(Date);
  });

  it("revokeAgent deletes agent but not embedded runner", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const embedded = await repo.ensureEmbedded(
      { os: "linux", arch: "x64" },
      ["code"],
    );
    const agent = await repo.registerAgent(
      {
        name: "worker-revoke",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential("cred"),
    );

    await repo.revokeAgent(agent.id);
    expect(await repo.findById(agent.id)).toBeNull();
    expect(await repo.findById(embedded.id)).not.toBeNull();

    await repo.revokeAgent(embedded.id);
    expect(await repo.findById(embedded.id)).not.toBeNull();
  });

  it("rotateCredential updates stored hash", async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const oldCredential = "old-credential";
    const newCredential = "new-credential";
    const agent = await repo.registerAgent(
      {
        name: "worker-rotate",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
      hashCredential(oldCredential),
    );

    expect(await repo.verifyCredential(agent.id, oldCredential)).toBe(true);
    expect(await repo.verifyCredential(agent.id, newCredential)).toBe(false);

    await repo.rotateCredential(agent.id, hashCredential(newCredential));

    expect(await repo.verifyCredential(agent.id, oldCredential)).toBe(false);
    expect(await repo.verifyCredential(agent.id, newCredential)).toBe(true);
  });
});
