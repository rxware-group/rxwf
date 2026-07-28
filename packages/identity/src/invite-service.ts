import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";
import { AwfError } from "@rxwf/shared";
import { createAuthService } from "./auth-service.js";
import { hashSecret } from "./crypto.js";
import { createUserService } from "./user-service.js";

const userInviteTokensTable = liteSchema.userInviteTokens;
const usersTable = liteSchema.users;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInviteService(db: LiteDatabase) {
  const userService = createUserService(db);
  const authService = createAuthService(db);

  async function findValidToken(token: string) {
    const tokenHash = hashSecret(token);
    const now = new Date();
    const rows = await db
      .select()
      .from(userInviteTokensTable)
      .where(
        and(
          eq(userInviteTokensTable.tokenHash, tokenHash),
          gt(userInviteTokensTable.expiresAt, now),
          isNull(userInviteTokensTable.usedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async function deleteUnusedTokens(userId: string) {
    await db
      .delete(userInviteTokensTable)
      .where(
        and(
          eq(userInviteTokensTable.userId, userId),
          isNull(userInviteTokensTable.usedAt),
        ),
      );
  }

  async function createToken(
    userId: string,
    invitedByUserId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await db.insert(userInviteTokensTable).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashSecret(token),
      expiresAt,
      usedAt: null,
      invitedByUserId,
      createdAt: new Date(),
    });

    return { token, expiresAt };
  }

  return {
    createToken,

    async accept(token: string, password: string): Promise<void> {
      const row = await findValidToken(token);
      if (!row) {
        throw new AwfError("E4002", "Invalid or expired invite token");
      }

      await userService.updatePassword(row.userId, password);
      await userService.setStatus(row.userId, "active");
      await userService.setMustChangePassword(row.userId, false);

      await db
        .update(userInviteTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(userInviteTokensTable.id, row.id));

      await authService.deleteUserSessions(row.userId);
    },

    async revokePending(userId: string): Promise<void> {
      await deleteUnusedTokens(userId);

      const user = await userService.findById(userId);
      if (user?.status === "pending_invite") {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    },

    async resend(
      userId: string,
      invitedByUserId: string,
    ): Promise<{ token: string; expiresAt: Date }> {
      await deleteUnusedTokens(userId);
      return createToken(userId, invitedByUserId);
    },
  };
}

export type InviteService = ReturnType<typeof createInviteService>;
