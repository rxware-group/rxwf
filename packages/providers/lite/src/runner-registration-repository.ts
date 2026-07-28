import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { LiteDatabase } from "./db.js";
import { runnerRegistrationTokens } from "./drizzle/schema.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseJsonArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is string => typeof item === "string");
}

export function createRunnerRegistrationRepository(db: LiteDatabase) {
  return {
    async createToken(input: {
      expiresAt: Date;
      createdBy?: string;
      labelsDefault?: string[];
    }): Promise<{ token: string; expiresAt: Date }> {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = input.expiresAt;
      const labelsDefault = input.labelsDefault ?? [];

      await db.insert(runnerRegistrationTokens).values({
        id: crypto.randomUUID(),
        tokenHash: hashToken(token),
        expiresAt,
        createdBy: input.createdBy ?? null,
        labelsDefault: JSON.stringify(labelsDefault),
        usedAt: null,
        createdAt: new Date(),
      });

      return { token, expiresAt };
    },

    async consumeToken(
      plaintextToken: string,
    ): Promise<{ labelsDefault: string[] } | null> {
      const tokenHash = hashToken(plaintextToken);
      const now = new Date();
      const rows = await db
        .select()
        .from(runnerRegistrationTokens)
        .where(
          and(
            eq(runnerRegistrationTokens.tokenHash, tokenHash),
            gt(runnerRegistrationTokens.expiresAt, now),
            isNull(runnerRegistrationTokens.usedAt),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return null;
      }

      await db
        .update(runnerRegistrationTokens)
        .set({ usedAt: new Date() })
        .where(eq(runnerRegistrationTokens.id, row.id));

      return { labelsDefault: parseJsonArray(row.labelsDefault) };
    },
  };
}
