import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";
import { AwfError } from "@rxwf/shared";
import { createAuthService } from "./auth-service.js";
import { hashSecret } from "./crypto.js";
import { createUserService } from "./user-service.js";

const passwordResetTokensTable = liteSchema.passwordResetTokens;
const TOKEN_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetService(db: LiteDatabase) {
  const userService = createUserService(db);
  const authService = createAuthService(db);

  async function findValidToken(token: string) {
    const tokenHash = hashSecret(token);
    const now = new Date();
    const rows = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          gt(passwordResetTokensTable.expiresAt, now),
          isNull(passwordResetTokensTable.usedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  return {
    async createToken(
      userId: string,
    ): Promise<{ token: string; expiresAt: Date }> {
      await db
        .delete(passwordResetTokensTable)
        .where(
          and(
            eq(passwordResetTokensTable.userId, userId),
            isNull(passwordResetTokensTable.usedAt),
          ),
        );

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
      await db.insert(passwordResetTokensTable).values({
        id: crypto.randomUUID(),
        userId,
        tokenHash: hashSecret(token),
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
      });

      return { token, expiresAt };
    },

    async consumeToken(token: string, password: string): Promise<void> {
      const row = await findValidToken(token);
      if (!row) {
        throw new AwfError("E4002", "Invalid or expired reset token");
      }

      await userService.updatePassword(row.userId, password);

      await db
        .update(passwordResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokensTable.id, row.id));

      await authService.deleteUserSessions(row.userId);
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
