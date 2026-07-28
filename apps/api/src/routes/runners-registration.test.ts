import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { buildApp } from "../app.js";
import { createAuthService, createUserService } from "@rxwf/identity";

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `runner-${crypto.randomUUID()}@example.com`,
    password: "secret",
    role: "admin",
  });
  const { key } = await auth.createApiKey(user.id, "test");
  return key;
}

describe("runner registration routes", () => {
  it("admin creates token, register, list, drain, rotate, delete", async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const key = await adminKey(db);

    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/runners/registration-tokens",
      headers: { "x-api-key": key },
      payload: { labels: ["gpu"] },
    });
    expect(tokenRes.statusCode).toBe(201);
    const tokenBody = tokenRes.json() as {
      registrationToken: string;
      expiresAt: string;
    };
    expect(tokenBody.registrationToken).toBeTruthy();
    expect(tokenBody.expiresAt).toMatch(/^\d{4}-/);

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/runners/register",
      payload: {
        registrationToken: tokenBody.registrationToken,
        name: "agent-1",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
        agentVersion: "1.0.0",
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const registered = registerRes.json() as {
      runnerId: string;
      runnerCredential: string;
    };
    expect(registered.runnerId).toBeTruthy();
    expect(registered.runnerCredential).toBeTruthy();

    const duplicateRes = await app.inject({
      method: "POST",
      url: "/api/runners/register",
      payload: {
        registrationToken: tokenBody.registrationToken,
        name: "agent-2",
        platform: { os: "linux", arch: "x64" },
        capabilities: ["code"],
      },
    });
    expect(duplicateRes.statusCode).toBe(401);
    expect(duplicateRes.json()).toMatchObject({
      code: "E2014",
      message: expect.stringContaining("token"),
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/runners",
      headers: { "x-api-key": key },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as {
      runners: Array<{
        id: string;
        name: string;
        kind: string;
        labels: string[];
        agentVersion: string | null;
        lastHeartbeatAt: string | null;
      }>;
    };
    const agent = listBody.runners.find((r) => r.id === registered.runnerId);
    expect(agent).toMatchObject({
      name: "agent-1",
      kind: "agent",
      labels: ["gpu"],
      agentVersion: "1.0.0",
      lastHeartbeatAt: null,
    });

    const drainRes = await app.inject({
      method: "POST",
      url: `/api/runners/${registered.runnerId}/drain`,
      headers: { "x-api-key": key },
    });
    expect(drainRes.statusCode).toBe(200);
    expect(drainRes.json()).toMatchObject({
      id: registered.runnerId,
      status: "draining",
    });

    const rotateRes = await app.inject({
      method: "POST",
      url: `/api/runners/${registered.runnerId}/rotate-credential`,
      headers: { "x-api-key": key },
    });
    expect(rotateRes.statusCode).toBe(200);
    const rotated = rotateRes.json() as { runnerCredential: string };
    expect(rotated.runnerCredential).toBeTruthy();
    expect(rotated.runnerCredential).not.toBe(registered.runnerCredential);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/runners/${registered.runnerId}`,
      headers: { "x-api-key": key },
    });
    expect(deleteRes.statusCode).toBe(204);

    const listAfterDelete = await app.inject({
      method: "GET",
      url: "/api/runners",
      headers: { "x-api-key": key },
    });
    const afterBody = listAfterDelete.json() as {
      runners: Array<{ id: string }>;
    };
    expect(
      afterBody.runners.some((r) => r.id === registered.runnerId),
    ).toBe(false);

    await app.close();
  });
});
