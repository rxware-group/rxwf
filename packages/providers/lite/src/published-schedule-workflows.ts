import { eq } from 'drizzle-orm';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { LiteDatabase } from './db.js';
import { workflows as workflowsTable, workflowVersions as versionsTable } from './drizzle/schema.js';

export function createPublishedScheduleWorkflowLoader(db: LiteDatabase) {
  return {
    async listPublishedWithDefinitions(): Promise<
      Array<{ workflowId: string; definition: WorkflowDefinition }>
    > {
      const publishedRows = await db
        .select({
          id: workflowsTable.id,
          publishedVersionId: workflowsTable.publishedVersionId,
        })
        .from(workflowsTable)
        .where(eq(workflowsTable.status, 'published'));

      const result: Array<{ workflowId: string; definition: WorkflowDefinition }> = [];

      for (const row of publishedRows) {
        if (!row.publishedVersionId) continue;
        const versionRows = await db
          .select({ definition: versionsTable.definition })
          .from(versionsTable)
          .where(eq(versionsTable.id, row.publishedVersionId))
          .limit(1);
        const published = versionRows[0];
        if (!published) continue;
        result.push({
          workflowId: row.id,
          definition: JSON.parse(published.definition) as WorkflowDefinition,
        });
      }

      return result;
    },
  };
}
