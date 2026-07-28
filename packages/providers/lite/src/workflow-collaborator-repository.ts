import { and, eq, ne, or, sql } from "drizzle-orm";
import type { LiteDatabase } from "./db.js";
import {
  users as usersTable,
  workflowCollaborators as collaboratorsTable,
  workflows as workflowsTable,
} from "./drizzle/schema.js";

export type WorkflowRole = "owner" | "editor" | "viewer";

export function createWorkflowCollaboratorRepository(db: LiteDatabase) {
  return {
    async list(
      workflowId: string,
    ): Promise<Array<{ userId: string; email: string; role: WorkflowRole; createdAt: Date }>> {
      const rows = await db
        .select({
          userId: collaboratorsTable.userId,
          email: usersTable.email,
          role: collaboratorsTable.role,
          createdAt: collaboratorsTable.createdAt,
        })
        .from(collaboratorsTable)
        .innerJoin(usersTable, eq(collaboratorsTable.userId, usersTable.id))
        .where(eq(collaboratorsTable.workflowId, workflowId));
      return rows.map((row) => ({
        userId: row.userId,
        email: row.email,
        role: row.role as WorkflowRole,
        createdAt: row.createdAt,
      }));
    },

    async upsert(workflowId: string, userId: string, role: WorkflowRole): Promise<void> {
      const now = new Date();
      await db
        .insert(collaboratorsTable)
        .values({
          workflowId,
          userId,
          role,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [collaboratorsTable.workflowId, collaboratorsTable.userId],
          set: { role },
        });
    },

    async remove(workflowId: string, userId: string): Promise<void> {
      await db
        .delete(collaboratorsTable)
        .where(
          and(
            eq(collaboratorsTable.workflowId, workflowId),
            eq(collaboratorsTable.userId, userId),
          ),
        );
    },

    async getEffectiveRole(
      workflowId: string,
      userId: string,
      createdByUserId: string | null,
    ): Promise<WorkflowRole | null> {
      if (createdByUserId !== null && userId === createdByUserId) {
        return "owner";
      }
      const rows = await db
        .select({ role: collaboratorsTable.role })
        .from(collaboratorsTable)
        .where(
          and(
            eq(collaboratorsTable.workflowId, workflowId),
            eq(collaboratorsTable.userId, userId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return row.role as WorkflowRole;
    },

    async listWorkflowIdsForUser(
      userId: string,
      scope: "mine" | "shared" | "all",
    ): Promise<string[]> {
      if (scope === "all") {
        const rows = await db.select({ id: workflowsTable.id }).from(workflowsTable);
        return rows.map((row) => row.id);
      }
      if (scope === "mine") {
        const rows = await db
          .select({ id: workflowsTable.id })
          .from(workflowsTable)
          .where(eq(workflowsTable.createdByUserId, userId));
        return rows.map((row) => row.id);
      }
      const rows = await db
        .select({ workflowId: collaboratorsTable.workflowId })
        .from(collaboratorsTable)
        .innerJoin(workflowsTable, eq(collaboratorsTable.workflowId, workflowsTable.id))
        .where(
          and(
            eq(collaboratorsTable.userId, userId),
            or(
              sql`${workflowsTable.createdByUserId} IS NULL`,
              ne(workflowsTable.createdByUserId, userId),
            ),
          ),
        );
      return rows.map((row) => row.workflowId);
    },
  };
}

export type WorkflowCollaboratorRepository = ReturnType<
  typeof createWorkflowCollaboratorRepository
>;
