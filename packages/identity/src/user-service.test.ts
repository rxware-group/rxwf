import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";

describe("UserService", () => {
  it("creates more than 20 users", async () => {
    const db = await createTestDb();
    const users = createUserService(db);

    for (let i = 0; i < 21; i++) {
      const row = await users.createUser({
        email: `user${i}@example.com`,
        password: "secret",
        role: "member",
      });
      expect(row.email).toBe(`user${i}@example.com`);
    }
    expect(await users.countUsers()).toBe(21);
  });

  it("verifyPassword accepts correct password", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    await users.createUser({
      email: "u@example.com",
      password: "correct-pass",
      role: "admin",
    });
    const ok = await users.verifyPassword("u@example.com", "correct-pass");
    expect(ok?.email).toBe("u@example.com");
    const bad = await users.verifyPassword("u@example.com", "wrong");
    expect(bad).toBeNull();
  });

  it("listUsers returns status and admin flag fields", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    await users.createUser({ email: "a@x.com", password: "secret1234", role: "admin" });
    await users.createDirectUser({
      email: "b@x.com",
      password: "secret1234",
      role: "member",
      mustChangePassword: true,
    });
    const rows = await users.listUsers();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.email === "b@x.com")?.mustChangePassword).toBe(true);
    expect(rows.find((r) => r.email === "b@x.com")?.joinMethod).toBe("direct");
  });

  it("countActiveAdmins counts only active admins", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    await users.createUser({ email: "solo@x.com", password: "secret1234", role: "admin" });
    expect(await users.countActiveAdmins()).toBe(1);
  });

  it("verifyPassword rejects disabled user", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const u = await users.createDirectUser({ email: "d@x.com", password: "secret1234", role: "member" });
    await users.setStatus(u.id, "disabled");
    expect(await users.verifyPassword("d@x.com", "secret1234")).toBeNull();
  });

  it("createPendingInviteUser sets pending_invite status", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const admin = await users.createUser({ email: "admin@x.com", password: "x", role: "admin" });
    const pending = await users.createPendingInviteUser({ email: "new@x.com", role: "member", invitedByUserId: admin.id });
    const row = await users.findById(pending.id);
    expect(row?.status).toBe("pending_invite");
  });
});
