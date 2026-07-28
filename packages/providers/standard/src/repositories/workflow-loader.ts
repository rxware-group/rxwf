import { and, desc, eq, isNull } from 'drizzle-orm';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { ExecutionEnqueueDeps } from '@rxwf/execution';
import type { StandardDatabase } from '../drizzle/client.js';
import {
  workflows as workflowsTable,
  workflowVersions as versionsTable,
} from '../drizzle/schema.js';

export type WorkflowDefinitionSource = 'draft' | 'published';

export function createStandardWorkflowLoader(
  db: StandardDatabase,
): Pick<ExecutionEnqueueDeps, 'loadWorkflow'> & {
  loadWorkflowForSource(
    workflowId: string,
    source: WorkflowDefinitionSource,
  ): ReturnType<ExecutionEnqueueDeps['loadWorkflow']>;
} {
  const loadVersionRow = async (
    workflowId: string,
    source: WorkflowDefinitionSource,
    publishedVersionId: string | null,
  ) => {
    if (source === 'published') {
      if (!publishedVersionId) return null;
      const rows = await db
        .select({
          id: versionsTable.id,
          version: versionsTable.version,
          definition: versionsTable.definition,
        })
        .from(versionsTable)
        .where(eq(versionsTable.id, publishedVersionId))
        .limit(1);
      return rows[0] ?? null;
    }
    const rows = await db
      .select({
        id: versionsTable.id,
        version: versionsTable.version,
        definition: versionsTable.definition,
      })
      .from(versionsTable)
      .where(
        and(eq(versionsTable.workflowId, workflowId), isNull(versionsTable.publishedAt)),
      )
      .orderBy(desc(versionsTable.createdAt))
      .limit(1);
    return rows[0] ?? null;
  };

  const loadWorkflowForSource = async (
    workflowId: string,
    source: WorkflowDefinitionSource,
  ) => {
    const wfRows = await db
      .select({
        id: workflowsTable.id,
        status: workflowsTable.status,
        publishedVersionId: workflowsTable.publishedVersionId,
      })
      .from(workflowsTable)
      .where(eq(workflowsTable.id, workflowId))
      .limit(1);
    const wf = wfRows[0];
    if (!wf) return null;

    const versionRow = await loadVersionRow(
      workflowId,
      source,
      wf.publishedVersionId ?? null,
    );
    if (!versionRow) return null;

    return {
      workflowId: wf.id,
      workflowVersionId: versionRow.id,
      version: versionRow.version,
      status: wf.status,
      definition: JSON.parse(versionRow.definition) as WorkflowDefinition,
    };
  };

  return {
    async loadWorkflow(workflowId: string) {
      return loadWorkflowForSource(workflowId, 'draft');
    },
    loadWorkflowForSource,
  };
}
