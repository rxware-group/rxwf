import { and, eq, gt } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";

const { apiKeys: apiKeysTable, sessions: sessionsTable, users: usersTable } =
  liteSchema;
import {
  generateApiKeyPlaintext,
  generateSessionToken,
  hashSecret,
} from "./crypto.js";
import type { LiteRole } from "./rbac.js";

export const SESSION_COOKIE_NAME = "awf_session";
export const API_KEY_HEADER = "x-api-key";

export interface AuthContext {
  userId: string;
  email: string;
  role: LiteRole;
  mustChangePassword: boolean;
  method: "session" | "apiKey";
}

export interface AuthHeaders {
  cookie?: string;
  apiKey?: string;
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function createAuthService(db: LiteDatabase) {
  return {
    parseRequestHeaders(headers: Record<string, string | string[] | undefined>): AuthHeaders {
      const cookie =
        typeof headers.cookie === "string" ? headers.cookie : headers.cookie?.[0];
      const apiKeyRaw = headers[API_KEY_HEADER] ?? headers["X-API-Key"];
      const apiKey =
        typeof apiKeyRaw === "string" ? apiKeyRaw : apiKeyRaw?.[0];
      return { cookie, apiKey };
    },

    async authenticate(headers: AuthHeaders): Promise<AuthContext | null> {
      const sessionToken = parseCookie(headers.cookie, SESSION_COOKIE_NAME);
      if (sessionToken) {
        const ctx = await this.validateSessionToken(sessionToken);
        if (ctx) return ctx;
      }

      if (headers.apiKey) {
        return this.validateApiKey(headers.apiKey);
      }

      return null;
    },

    async validateApiKey(apiKey: string): Promise<AuthContext | null> {
      const keyHash = hashSecret(apiKey);
      const rows = await db
        .select({
          userId: apiKeysTable.userId,
          email: usersTable.email,
          role: usersTable.role,
          status: usersTable.status,
          mustChangePassword: usersTable.mustChangePassword,
        })
        .from(apiKeysTable)
        .innerJoin(usersTable, eq(apiKeysTable.userId, usersTable.id))
        .where(eq(apiKeysTable.keyHash, keyHash))
        .limit(1);

      const row = rows[0];
      if (!row || row.status !== "active") return null;

      return {
        userId: row.userId,
        email: row.email,
        role: row.role as LiteRole,
        mustChangePassword: row.mustChangePassword,
        method: "apiKey",
      };
    },

    async validateSessionToken(token: string): Promise<AuthContext | null> {
      const tokenHash = hashSecret(token);
      const now = new Date();
      const rows = await db
        .select({
          userId: sessionsTable.userId,
          email: usersTable.email,
          role: usersTable.role,
          status: usersTable.status,
          mustChangePassword: usersTable.mustChangePassword,
        })
        .from(sessionsTable)
        .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
        .where(
          and(
            eq(sessionsTable.tokenHash, tokenHash),
            gt(sessionsTable.expiresAt, now),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row || row.status !== "active") return null;

      return {
        userId: row.userId,
        email: row.email,
        role: row.role as LiteRole,
        mustChangePassword: row.mustChangePassword,
        method: "session",
      };
    },

    async createSession(
      userId: string,
      ttlMs = 7 * 24 * 60 * 60 * 1000,
    ): Promise<{ token: string; expiresAt: Date }> {
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + ttlMs);
      await db.insert(sessionsTable).values({
        id: crypto.randomUUID(),
        userId,
        tokenHash: hashSecret(token),
        expiresAt,
        createdAt: new Date(),
      });
      return { token, expiresAt };
    },

    async createApiKey(
      userId: string,
      name: string,
    ): Promise<{ id: string; key: string }> {
      const key = generateApiKeyPlaintext();
      const id = crypto.randomUUID();
      await db.insert(apiKeysTable).values({
        id,
        userId,
        keyHash: hashSecret(key),
        name,
        createdAt: new Date(),
      });
      return { id, key };
    },

    async listApiKeys(
      userId: string,
    ): Promise<Array<{ id: string; name: string; createdAt: Date }>> {
      const rows = await db
        .select({
          id: apiKeysTable.id,
          name: apiKeysTable.name,
          createdAt: apiKeysTable.createdAt,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.userId, userId));
      return rows;
    },

    async deleteUserSessions(userId: string): Promise<void> {
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    },

    async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
      const rows = await db
        .select({ id: apiKeysTable.id })
        .from(apiKeysTable)
        .where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, userId)))
        .limit(1);
      if (!rows[0]) return false;
      await db.delete(apiKeysTable).where(eq(apiKeysTable.id, keyId));
      return true;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
