import { and, eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import {
  knowledgeBaseCollaborators as collaboratorsTable,
  users as usersTable,
} from './drizzle/schema.js';

export type KnowledgeBaseRole = 'owner' | 'editor' | 'viewer';

export function createKnowledgeBaseCollaboratorRepository(db: LiteDatabase) {
  return {
    async list(
      knowledgeBaseId: string,
    ): Promise<
      Array<{ userId: string; email: string; role: KnowledgeBaseRole; createdAt: Date }>
    > {
      const rows = await db
        .select({
          userId: collaboratorsTable.userId,
          email: usersTable.email,
          role: collaboratorsTable.role,
          createdAt: collaboratorsTable.createdAt,
        })
        .from(collaboratorsTable)
        .innerJoin(usersTable, eq(collaboratorsTable.userId, usersTable.id))
        .where(eq(collaboratorsTable.knowledgeBaseId, knowledgeBaseId));
      return rows.map((row) => ({
        userId: row.userId,
        email: row.email,
        role: row.role as KnowledgeBaseRole,
        createdAt: row.createdAt,
      }));
    },

    async upsert(
      knowledgeBaseId: string,
      userId: string,
      role: KnowledgeBaseRole,
    ): Promise<void> {
      const now = new Date();
      await db
        .insert(collaboratorsTable)
        .values({
          knowledgeBaseId,
          userId,
          role,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [collaboratorsTable.knowledgeBaseId, collaboratorsTable.userId],
          set: { role },
        });
    },

    async remove(knowledgeBaseId: string, userId: string): Promise<void> {
      await db
        .delete(collaboratorsTable)
        .where(
          and(
            eq(collaboratorsTable.knowledgeBaseId, knowledgeBaseId),
            eq(collaboratorsTable.userId, userId),
          ),
        );
    },

    async getEffectiveRole(
      knowledgeBaseId: string,
      userId: string,
      ownerUserId: string,
    ): Promise<KnowledgeBaseRole | null> {
      if (userId === ownerUserId) return 'owner';
      const rows = await db
        .select({ role: collaboratorsTable.role })
        .from(collaboratorsTable)
        .where(
          and(
            eq(collaboratorsTable.knowledgeBaseId, knowledgeBaseId),
            eq(collaboratorsTable.userId, userId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return row.role as KnowledgeBaseRole;
    },

    async listSharedKnowledgeBaseIds(userId: string): Promise<string[]> {
      const rows = await db
        .select({ knowledgeBaseId: collaboratorsTable.knowledgeBaseId })
        .from(collaboratorsTable)
        .where(eq(collaboratorsTable.userId, userId));
      return rows.map((row) => row.knowledgeBaseId);
    },
  };
}

export type KnowledgeBaseCollaboratorRepository = ReturnType<
  typeof createKnowledgeBaseCollaboratorRepository
>;
