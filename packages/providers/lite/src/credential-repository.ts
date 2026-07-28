import { eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { credentials as credentialsTable } from './drizzle/schema.js';

export function createLiteCredentialRepository(db: LiteDatabase) {
  return {
    async insert(row: {
      id: string;
      name: string;
      type: string;
      dataEncrypted: string;
    }): Promise<void> {
      const now = new Date();
      await db.insert(credentialsTable).values({
        id: row.id,
        name: row.name,
        type: row.type,
        dataEncrypted: row.dataEncrypted,
        createdAt: now,
        updatedAt: now,
      });
    },

    async list() {
      const rows = await db
        .select({
          id: credentialsTable.id,
          name: credentialsTable.name,
          type: credentialsTable.type,
        })
        .from(credentialsTable);
      return rows;
    },

    async findById(id: string) {
      const rows = await db
        .select()
        .from(credentialsTable)
        .where(eq(credentialsTable.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db
        .delete(credentialsTable)
        .where(eq(credentialsTable.id, id));
      return result.changes > 0;
    },
  };
}
