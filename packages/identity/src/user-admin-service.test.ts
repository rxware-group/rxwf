import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createInviteService } from "./invite-service.js";
import { createUserAdminService } from "./user-admin-service.js";
import { createUserService } from "./user-service.js";

describe("UserAdminService", () => {
  it("rejects demoting the last active admin", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const invites = createInviteService(db);
    const svc = createUserAdminService({ users, invites });
    const admin = await users.createUser({
      email: "solo@x.com",
      password: "secret1234",
      role: "admin",
    });
    await expect(svc.setAdmin(admin.id, false)).rejects.toMatchObject({
      code: "E4003",
    });
  });
});
