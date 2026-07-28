import { desc, eq } from 'drizzle-orm';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { LiteDatabase } from './db.js';
import { workflows as workflowsTable, workflowVersions as versionsTable } from './drizzle/schema.js';

export function createActiveScheduleWorkflowLoader(db: LiteDatabase) {
  return {
    async listActiveWithDefinitions(): Promise<
      Array<{ workflowId: string; definition: WorkflowDefinition }>
    > {
      const activeRows = await db
        .select({ id: workflowsTable.id })
        .from(workflowsTable)
        .where(eq(workflowsTable.status, 'active'));

      const result: Array<{ workflowId: string; definition: WorkflowDefinition }> = [];

      for (const row of activeRows) {
        const versionRows = await db
          .select({ definition: versionsTable.definition })
          .from(versionsTable)
          .where(eq(versionsTable.workflowId, row.id))
          .orderBy(desc(versionsTable.version))
          .limit(1);
        const latest = versionRows[0];
        if (!latest) continue;
        result.push({
          workflowId: row.id,
          definition: JSON.parse(latest.definition) as WorkflowDefinition,
        });
      }

      return result;
    },
  };
}
