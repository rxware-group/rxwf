import { describe, it, expect } from "vitest";
import { createRunnerRegistrationRepository } from "./runner-registration-repository.js";
import { createTestDb } from "./test-db.js";

describe("RunnerRegistrationRepository", () => {
  it("createToken returns token", async () => {
    const db = await createTestDb();
    const repo = createRunnerRegistrationRepository(db);
    const expiresAt = new Date(Date.now() + 60_000);
    const result = await repo.createToken({ expiresAt });
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
    expect(result.expiresAt).toEqual(expiresAt);
  });

  it("consumeToken succeeds once", async () => {
    const db = await createTestDb();
    const repo = createRunnerRegistrationRepository(db);
    const labelsDefault = ["gpu", "linux"];
    const expiresAt = new Date(Date.now() + 60_000);
    const { token } = await repo.createToken({ expiresAt, labelsDefault });
    const consumed = await repo.consumeToken(token);
    expect(consumed).toEqual({ labelsDefault: ["gpu", "linux"] });
  });

  it("second consume fails (null)", async () => {
    const db = await createTestDb();
    const repo = createRunnerRegistrationRepository(db);
    const expiresAt = new Date(Date.now() + 60_000);
    const { token } = await repo.createToken({ expiresAt });
    await repo.consumeToken(token);
    const second = await repo.consumeToken(token);
    expect(second).toBeNull();
  });

  it("expired token fails", async () => {
    const db = await createTestDb();
    const repo = createRunnerRegistrationRepository(db);
    const expiresAt = new Date(Date.now() - 1000);
    const { token } = await repo.createToken({ expiresAt });
    const consumed = await repo.consumeToken(token);
    expect(consumed).toBeNull();
  });
});
