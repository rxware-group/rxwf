import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";
import { createInviteService } from "./invite-service.js";

describe("InviteService", () => {
  it("creates token and accepts invite with password", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const admin = await users.createUser({
      email: "admin@x.com",
      password: "secret1234",
      role: "admin",
    });
    const pending = await users.createPendingInviteUser({
      email: "new@x.com",
      role: "member",
      invitedByUserId: admin.id,
    });
    const invites = createInviteService(db);
    const { token } = await invites.createToken(pending.id, admin.id);
    await invites.accept(token, "new-password-12");
    const row = await users.findById(pending.id);
    expect(row?.status).toBe("active");
    const ok = await users.verifyPassword("new@x.com", "new-password-12");
    expect(ok).not.toBeNull();
  });
});
