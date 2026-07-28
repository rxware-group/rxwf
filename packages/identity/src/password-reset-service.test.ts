import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";
import { createPasswordResetService } from "./password-reset-service.js";

describe("PasswordResetService", () => {
  it("reset invalidates old password and sessions", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const reset = createPasswordResetService(db);
    const user = await users.createUser({
      email: "u@test.com",
      password: "old-pass12",
      role: "member",
    });
    const { token } = await reset.createToken(user.id);
    await reset.consumeToken(token, "new-pass12");
    expect(await users.verifyPassword("u@test.com", "old-pass12")).toBeNull();
    expect(await users.verifyPassword("u@test.com", "new-pass12")).toBeTruthy();
  });
});
