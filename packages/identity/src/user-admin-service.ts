import { randomBytes } from "node:crypto";
import { AwfError } from "@rxwf/shared";
import type { InviteService } from "./invite-service.js";
import type { AdminUserRow, UserService, UserStatus } from "./user-service.js";

function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

async function assertEmailAvailable(
  users: UserService,
  email: string,
): Promise<void> {
  const existing = await users.findByEmail(email);
  if (existing) {
    throw new AwfError("E1004", "Email already in use");
  }
}

async function assertNotLastAdmin(
  users: UserService,
  userId: string,
): Promise<void> {
  const user = await users.findById(userId);
  if (!user) {
    throw new AwfError("E1001", "User not found");
  }
  if (user.role !== "admin") {
    return;
  }

  const allUsers = await users.listUsers();
  const adminCount = allUsers.filter((row) => row.role === "admin").length;
  if (adminCount <= 1) {
    throw new AwfError("E4003", "At least one admin required");
  }
}

export function createUserAdminService(deps: {
  users: UserService;
  invites: InviteService;
}) {
  const { users, invites } = deps;

  return {
    async list(): Promise<AdminUserRow[]> {
      return users.listUsers();
    },

    async invite(input: {
      email: string;
      isAdmin: boolean;
      invitedByUserId: string;
    }): Promise<{ userId: string; token: string }> {
      await assertEmailAvailable(users, input.email);

      const user = await users.createPendingInviteUser({
        email: input.email,
        role: input.isAdmin ? "admin" : "member",
        invitedByUserId: input.invitedByUserId,
      });
      const { token } = await invites.createToken(
        user.id,
        input.invitedByUserId,
      );

      return { userId: user.id, token };
    },

    async directCreate(input: {
      email: string;
      password: string;
      isAdmin: boolean;
      mustChangePassword?: boolean;
    }): Promise<{ user: AdminUserRow; temporaryPassword?: string }> {
      await assertEmailAvailable(users, input.email);

      const user = await users.createDirectUser({
        email: input.email,
        password: input.password,
        role: input.isAdmin ? "admin" : "member",
        mustChangePassword: input.mustChangePassword,
      });

      return { user };
    },

    async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
      const user = await users.findById(userId);
      if (!user) {
        throw new AwfError("E1001", "User not found");
      }

      if (!isAdmin && user.role === "admin") {
        const count = await users.countActiveAdmins();
        if (count <= 1) {
          throw new AwfError("E4003", "At least one admin required");
        }
      }

      await users.setRole(userId, isAdmin ? "admin" : "member");
    },

    async setStatus(userId: string, status: UserStatus): Promise<void> {
      const user = await users.findById(userId);
      if (!user) {
        throw new AwfError("E1001", "User not found");
      }

      await users.setStatus(userId, status);
    },

    async resetPassword(
      userId: string,
    ): Promise<{ temporaryPassword: string }> {
      const user = await users.findById(userId);
      if (!user) {
        throw new AwfError("E1001", "User not found");
      }

      const temporaryPassword = generateTemporaryPassword();
      await users.updatePassword(userId, temporaryPassword);
      await users.setMustChangePassword(userId, true);

      return { temporaryPassword };
    },

    async resendInvite(
      userId: string,
      invitedByUserId: string,
    ): Promise<{ token: string }> {
      const user = await users.findById(userId);
      if (!user) {
        throw new AwfError("E1001", "User not found");
      }

      const { token } = await invites.resend(userId, invitedByUserId);
      return { token };
    },

    async revokeInvite(userId: string): Promise<void> {
      await invites.revokePending(userId);
    },

    async deleteDisabled(userId: string): Promise<void> {
      await assertNotLastAdmin(users, userId);
      await users.deleteUser(userId);
    },
  };
}

export type UserAdminService = ReturnType<typeof createUserAdminService>;
