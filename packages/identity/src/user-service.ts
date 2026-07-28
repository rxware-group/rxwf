import { and, count, desc, eq } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";
import { AwfError } from "@rxwf/shared";

const usersTable = liteSchema.users;
import { hashPassword, verifyPassword as verifyPasswordHash } from "./crypto.js";
import type { LiteRole } from "./rbac.js";

export type UserStatus = "active" | "disabled" | "pending_invite";
export type JoinMethod = "invite" | "direct";

export interface CreateUserInput {
  email: string;
  password: string;
  role: LiteRole;
}

export interface UserRecord {
  id: string;
  email: string;
  role: LiteRole;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: LiteRole;
  status: UserStatus;
  joinMethod: JoinMethod | null;
  mustChangePassword: boolean;
  nickname: string;
  avatarUrl: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const adminUserSelect = {
  id: usersTable.id,
  email: usersTable.email,
  role: usersTable.role,
  status: usersTable.status,
  joinMethod: usersTable.joinMethod,
  mustChangePassword: usersTable.mustChangePassword,
  nickname: usersTable.nickname,
  avatarUrl: usersTable.avatarUrl,
  lastLoginAt: usersTable.lastLoginAt,
  createdAt: usersTable.createdAt,
};

function toAdminUserRow(row: {
  id: string;
  email: string;
  role: string;
  status: string;
  joinMethod: string | null;
  mustChangePassword: boolean;
  nickname: string;
  avatarUrl: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role as LiteRole,
    status: row.status as UserStatus,
    joinMethod: (row.joinMethod as JoinMethod | null) ?? null,
    mustChangePassword: row.mustChangePassword,
    nickname: row.nickname ?? '',
    avatarUrl: row.avatarUrl ?? '',
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.createdAt,
  };
}

export function createUserService(db: LiteDatabase) {
  return {
    async countUsers(): Promise<number> {
      const [row] = await db.select({ value: count() }).from(usersTable);
      return row?.value ?? 0;
    },

    async createUser(input: CreateUserInput): Promise<UserRecord> {
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(usersTable).values({
        id,
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        status: "active",
        joinMethod: null,
        mustChangePassword: false,
        createdAt: now,
      });

      return { id, email: input.email, role: input.role };
    },

    async createDirectUser(input: {
      email: string;
      password: string;
      role: LiteRole;
      mustChangePassword?: boolean;
    }): Promise<AdminUserRow> {
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(usersTable).values({
        id,
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        status: "active",
        joinMethod: "direct",
        mustChangePassword: input.mustChangePassword ?? false,
        createdAt: now,
      });

      return {
        id,
        email: input.email,
        role: input.role,
        status: "active",
        joinMethod: "direct",
        mustChangePassword: input.mustChangePassword ?? false,
        nickname: "",
        avatarUrl: "",
        lastLoginAt: null,
        createdAt: now,
      };
    },

    async createPendingInviteUser(input: {
      email: string;
      role: LiteRole;
      invitedByUserId: string;
    }): Promise<AdminUserRow> {
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(usersTable).values({
        id,
        email: input.email,
        passwordHash: hashPassword(crypto.randomUUID()),
        role: input.role,
        status: "pending_invite",
        joinMethod: "invite",
        mustChangePassword: false,
        createdAt: now,
      });

      return {
        id,
        email: input.email,
        role: input.role,
        status: "pending_invite",
        joinMethod: "invite",
        mustChangePassword: false,
        nickname: "",
        avatarUrl: "",
        lastLoginAt: null,
        createdAt: now,
      };
    },

    async listUsers(): Promise<AdminUserRow[]> {
      const rows = await db
        .select(adminUserSelect)
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt));

      return rows.map(toAdminUserRow);
    },

    async findById(id: string): Promise<AdminUserRow | null> {
      const rows = await db
        .select(adminUserSelect)
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      return toAdminUserRow(row);
    },

    async setStatus(id: string, status: UserStatus): Promise<void> {
      await db.update(usersTable).set({ status }).where(eq(usersTable.id, id));
    },

    async setRole(id: string, role: LiteRole): Promise<void> {
      await db.update(usersTable).set({ role }).where(eq(usersTable.id, id));
    },

    async setMustChangePassword(id: string, value: boolean): Promise<void> {
      await db
        .update(usersTable)
        .set({ mustChangePassword: value })
        .where(eq(usersTable.id, id));
    },

    async touchLastLogin(id: string): Promise<void> {
      await db
        .update(usersTable)
        .set({ lastLoginAt: new Date() })
        .where(eq(usersTable.id, id));
    },

    async countActiveAdmins(): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "active")));

      return row?.value ?? 0;
    },

    async deleteUser(id: string): Promise<void> {
      const rows = await db
        .select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) {
        throw new AwfError("E1001", "User not found");
      }
      if (row.status !== "disabled") {
        throw new AwfError("E4003", "Only disabled users can be deleted");
      }

      await db.delete(usersTable).where(eq(usersTable.id, id));
    },

    async verifyPassword(
      email: string,
      password: string,
    ): Promise<UserRecord | null> {
      const rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
          passwordHash: usersTable.passwordHash,
          status: usersTable.status,
        })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      const row = rows[0];
      if (
        !row ||
        row.status !== "active" ||
        !verifyPasswordHash(password, row.passwordHash)
      ) {
        return null;
      }
      return {
        id: row.id,
        email: row.email,
        role: row.role as LiteRole,
      };
    },

    async findByEmail(email: string): Promise<UserRecord | null> {
      const rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
        })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        role: row.role as LiteRole,
      };
    },

    async updatePassword(userId: string, password: string): Promise<void> {
      await db
        .update(usersTable)
        .set({ passwordHash: hashPassword(password) })
        .where(eq(usersTable.id, userId));
    },

    async updateProfile(
      id: string,
      input: { nickname?: string; avatarUrl?: string | null },
    ): Promise<AdminUserRow> {
      const existing = await this.findById(id);
      if (!existing) {
        throw new AwfError("E1001", "User not found");
      }

      const updates: { nickname?: string; avatarUrl?: string } = {};
      if (input.nickname !== undefined) {
        const nickname = input.nickname.trim();
        if (nickname.length > 64) {
          throw new AwfError("E1004", "Nickname must be at most 64 characters");
        }
        updates.nickname = nickname;
      }
      if (input.avatarUrl !== undefined) {
        const avatarUrl = input.avatarUrl === null ? "" : input.avatarUrl.trim();
        if (avatarUrl.length > 100_000) {
          throw new AwfError("E1004", "Avatar image is too large");
        }
        updates.avatarUrl = avatarUrl;
      }

      if (Object.keys(updates).length === 0) {
        return existing;
      }

      await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
      const updated = await this.findById(id);
      if (!updated) {
        throw new AwfError("E1001", "User not found");
      }
      return updated;
    },

    async ensureBootstrapAdmin(email: string): Promise<UserRecord | null> {
      const total = await this.countUsers();
      if (total > 0) return null;

      return this.createUser({
        email,
        password: crypto.randomUUID(),
        role: "admin",
      });
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
