import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { buildApp } from "./app.js";
import { createAuthService } from "@rxwf/identity";
import { createUserService } from "@rxwf/identity";

describe("GET /api/workflows auth", () => {
  it("rejects missing api key on protected route", async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const res = await app.inject({ method: "GET", url: "/api/workflows" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns 200 with valid api key", async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: "admin@example.com",
      password: "secret",
      role: "admin",
    });
    const { key } = await auth.createApiKey(user.id, "test");

    const res = await app.inject({
      method: "GET",
      url: "/api/workflows",
      headers: { "x-api-key": key },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ workflows: [] });
    await app.close();
  });
});
