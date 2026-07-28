import { eq } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "@rxwf/credential";
import { MASK, SENSITIVE_KEYS } from "./keys.js";

const table = liteSchema.systemSettings;

export function createSystemSettingsService(
  db: LiteDatabase,
  encryptionKey: Buffer,
) {
  const readValue = (row: { value: string; sensitive: boolean }) =>
    row.sensitive
      ? decryptCredentialPayload(row.value, encryptionKey)
      : row.value;

  return {
    async get(key: string): Promise<string | undefined> {
      const rows = await db
        .select()
        .from(table)
        .where(eq(table.key, key))
        .limit(1);
      const row = rows[0];
      return row ? readValue(row) : undefined;
    },

    async getMany(keys: string[]): Promise<Record<string, string>> {
      const out: Record<string, string> = {};
      for (const key of keys) {
        const v = await this.get(key);
        if (v !== undefined) out[key] = v;
      }
      return out;
    },

    async set(key: string, value: string, sensitive = SENSITIVE_KEYS.has(key)) {
      const stored = sensitive
        ? encryptCredentialPayload(value, encryptionKey)
        : value;
      const now = new Date();
      const rows = await db.select().from(table).where(eq(table.key, key)).limit(1);
      if (rows[0]) {
        await db
          .update(table)
          .set({ value: stored, sensitive, updatedAt: now })
          .where(eq(table.key, key));
      } else {
        await db.insert(table).values({ key, value: stored, sensitive, updatedAt: now });
      }
    },

    async setMany(
      entries: Array<{ key: string; value: string; sensitive?: boolean }>,
    ) {
      for (const e of entries) {
        if (SENSITIVE_KEYS.has(e.key) && e.value === "") continue;
        await this.set(e.key, e.value, e.sensitive ?? SENSITIVE_KEYS.has(e.key));
      }
    },

    async getPublicSnapshot(): Promise<Record<string, string>> {
      const rows = await db.select().from(table);
      const out: Record<string, string> = {};
      for (const row of rows) {
        out[row.key] = row.sensitive ? MASK : row.value;
      }
      return out;
    },
  };
}

export type SystemSettingsService = ReturnType<typeof createSystemSettingsService>;
