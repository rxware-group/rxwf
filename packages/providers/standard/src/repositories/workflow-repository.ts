import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { WorkflowRepositoryPort } from '@rxwf/workflow';
import type { StandardDatabase } from '../drizzle/client.js';
import {
  users as usersTable,
  workflows as workflowsTable,
  workflowVersions as versionsTable,
  workflowPublishLog as publishLogTable,
} from '../drizzle/schema.js';

function mapVersionRow(
  row: {
    id: string;
    workflowId: string;
    version: number;
    definition: string;
    semverLabel: string | null;
    changeNote: string | null;
    publishedAt: Date | null;
    publishedByUserId: string | null;
    publishNote: string | null;
    createdAt: Date;
  },
) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    version: row.version,
    definition: row.definition,
    semverLabel: row.semverLabel ?? '1.0.0',
    changeNote: row.changeNote ?? null,
    publishedAt: row.publishedAt ?? null,
    publishedByUserId: row.publishedByUserId ?? null,
    publishNote: row.publishNote ?? null,
    createdAt: row.createdAt,
  };
}

export function createStandardWorkflowRepository(
  db: StandardDatabase,
): WorkflowRepositoryPort {
  return {
    async insertWorkflow(row) {
      await db.insert(workflowsTable).values({
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        publishedVersionId: row.publishedVersionId ?? null,
        publishedAt: row.publishedAt ?? null,
        createdByUserId: row.createdByUserId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    },

    async insertVersion(row) {
      await db.insert(versionsTable).values({
        id: row.id,
        workflowId: row.workflowId,
        version: row.version,
        definition: row.definition,
        semverLabel: row.semverLabel,
        changeNote: row.changeNote ?? null,
        publishedAt: row.publishedAt ?? null,
        publishedByUserId: row.publishedByUserId ?? null,
        publishNote: row.publishNote ?? null,
        createdAt: row.createdAt,
      });
    },

    async updateWorkflow(row) {
      await db
        .update(workflowsTable)
        .set({
          name: row.name,
          description: row.description ?? '',
          status: row.status,
          publishedVersionId: row.publishedVersionId ?? null,
          publishedAt: row.publishedAt ?? null,
          updatedAt: row.updatedAt,
        })
        .where(eq(workflowsTable.id, row.id));
    },

    async getWorkflow(id) {
      const rows = await db
        .select({
          id: workflowsTable.id,
          name: workflowsTable.name,
          description: workflowsTable.description,
          status: workflowsTable.status,
          publishedVersionId: workflowsTable.publishedVersionId,
          publishedAt: workflowsTable.publishedAt,
          createdByUserId: workflowsTable.createdByUserId,
          createdAt: workflowsTable.createdAt,
          updatedAt: workflowsTable.updatedAt,
        })
        .from(workflowsTable)
        .where(eq(workflowsTable.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        publishedVersionId: row.publishedVersionId ?? null,
        publishedAt: row.publishedAt ?? null,
        createdByUserId: row.createdByUserId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async findByName(name) {
      const rows = await db
        .select({ id: workflowsTable.id })
        .from(workflowsTable)
        .where(eq(workflowsTable.name, name))
        .limit(1);
      return rows[0] ?? null;
    },

    async getDraftVersion(workflowId) {
      const rows = await db
        .select({
          id: versionsTable.id,
          workflowId: versionsTable.workflowId,
          version: versionsTable.version,
          definition: versionsTable.definition,
          semverLabel: versionsTable.semverLabel,
          changeNote: versionsTable.changeNote,
          publishedAt: versionsTable.publishedAt,
          publishedByUserId: versionsTable.publishedByUserId,
          publishNote: versionsTable.publishNote,
          createdAt: versionsTable.createdAt,
        })
        .from(versionsTable)
        .where(
          and(eq(versionsTable.workflowId, workflowId), isNull(versionsTable.publishedAt)),
        )
        .orderBy(desc(versionsTable.createdAt))
        .limit(1);
      const row = rows[0];
      return row ? mapVersionRow(row) : null;
    },

    async updateDraftVersion(workflowId, definition) {
      const draft = await this.getDraftVersion(workflowId);
      if (!draft) return false;
      await db
        .update(versionsTable)
        .set({ definition })
        .where(eq(versionsTable.id, draft.id));
      return true;
    },

    async getVersionById(versionId) {
      const rows = await db
        .select({
          id: versionsTable.id,
          workflowId: versionsTable.workflowId,
          version: versionsTable.version,
          definition: versionsTable.definition,
          semverLabel: versionsTable.semverLabel,
          changeNote: versionsTable.changeNote,
          publishedAt: versionsTable.publishedAt,
          publishedByUserId: versionsTable.publishedByUserId,
          publishNote: versionsTable.publishNote,
          createdAt: versionsTable.createdAt,
        })
        .from(versionsTable)
        .where(eq(versionsTable.id, versionId))
        .limit(1);
      const row = rows[0];
      return row ? mapVersionRow(row) : null;
    },

    async getPublishedVersion(workflowId, version) {
      const rows = await db
        .select({
          id: versionsTable.id,
          workflowId: versionsTable.workflowId,
          version: versionsTable.version,
          definition: versionsTable.definition,
          semverLabel: versionsTable.semverLabel,
          changeNote: versionsTable.changeNote,
          publishedAt: versionsTable.publishedAt,
          publishedByUserId: versionsTable.publishedByUserId,
          publishNote: versionsTable.publishNote,
          createdAt: versionsTable.createdAt,
        })
        .from(versionsTable)
        .where(
          and(
            eq(versionsTable.workflowId, workflowId),
            eq(versionsTable.version, version),
            isNotNull(versionsTable.publishedAt),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? mapVersionRow(row) : null;
    },

    async getNextPublishedVersionNumber(workflowId) {
      const rows = await db
        .select({ version: versionsTable.version })
        .from(versionsTable)
        .where(
          and(eq(versionsTable.workflowId, workflowId), isNotNull(versionsTable.publishedAt)),
        );
      if (rows.length === 0) return 1;
      return Math.max(...rows.map((r) => r.version)) + 1;
    },

    async listPublishedVersions(workflowId) {
      const wf = await this.getWorkflow(workflowId);
      const rows = await db
        .select({
          id: versionsTable.id,
          version: versionsTable.version,
          semverLabel: versionsTable.semverLabel,
          publishNote: versionsTable.publishNote,
          publishedAt: versionsTable.publishedAt,
          publishedByUserId: versionsTable.publishedByUserId,
          publishedByEmail: usersTable.email,
        })
        .from(versionsTable)
        .leftJoin(usersTable, eq(versionsTable.publishedByUserId, usersTable.id))
        .where(
          and(eq(versionsTable.workflowId, workflowId), isNotNull(versionsTable.publishedAt)),
        )
        .orderBy(desc(versionsTable.version));
      return rows.map((row) => ({
        id: row.id,
        version: row.version,
        semverLabel: row.semverLabel ?? '1.0.0',
        publishNote: row.publishNote ?? null,
        publishedAt: row.publishedAt!,
        publishedByUserId: row.publishedByUserId ?? null,
        publishedByEmail: row.publishedByEmail ?? null,
        isCurrent: wf?.publishedVersionId === row.id,
      }));
    },

    async appendPublishLog(input) {
      const now = new Date();
      await db.insert(publishLogTable).values({
        id: input.id,
        workflowId: input.workflowId,
        versionId: input.versionId,
        action: input.action,
        detailJson: JSON.stringify(input.detail),
        userId: input.userId,
        createdAt: now,
      });
    },

    async listWorkflows(options?: { ids?: string[] }) {
      const rows = await db
        .select({
          id: workflowsTable.id,
          name: workflowsTable.name,
          description: workflowsTable.description,
          status: workflowsTable.status,
          publishedVersionId: workflowsTable.publishedVersionId,
          createdAt: workflowsTable.createdAt,
          updatedAt: workflowsTable.updatedAt,
          createdByUserId: workflowsTable.createdByUserId,
          createdByEmail: usersTable.email,
          createdByNickname: usersTable.nickname,
        })
        .from(workflowsTable)
        .leftJoin(usersTable, eq(workflowsTable.createdByUserId, usersTable.id))
        .where(
          options?.ids?.length ? inArray(workflowsTable.id, options.ids) : undefined,
        );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        publishedVersionId: row.publishedVersionId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdByUserId: row.createdByUserId ?? null,
        createdByEmail: row.createdByEmail ?? null,
        createdByNickname: row.createdByNickname ?? null,
      }));
    },

    async deleteWorkflow(workflowId: string) {
      const existing = await this.getWorkflow(workflowId);
      if (!existing) return false;
      await db.delete(publishLogTable).where(eq(publishLogTable.workflowId, workflowId));
      await db
        .delete(versionsTable)
        .where(eq(versionsTable.workflowId, workflowId));
      const result = await db
        .delete(workflowsTable)
        .where(eq(workflowsTable.id, workflowId));
      return (result.rowCount ?? 0) > 0;
    },
  };
}
