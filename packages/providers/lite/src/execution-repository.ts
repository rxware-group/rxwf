import { and, desc, eq, sql } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { executions as executionsTable, workflows as workflowsTable } from './drizzle/schema.js';

export interface ExecutionRow {
  id: string;
  traceId: string;
  workflowId: string;
  workflowVersionId: string;
  definitionSnapshot: string;
  status: string;
  mode: string;
  environment: string;
  sessionId?: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface ExecutionListRow extends ExecutionRow {
  workflowName: string;
}

export interface ExecutionInsertRecord {
  id: string;
  traceId: string;
  workflowId: string;
  workflowVersionId: string;
  definitionSnapshot: string;
  status: string;
  mode: string;
  environment: string;
  idempotencyKey?: string;
  sessionId?: string;
}

export function createLiteExecutionRepository(db: LiteDatabase) {
  return {
    async insertExecution(record: ExecutionInsertRecord): Promise<void> {
      const now = new Date();
      await db.insert(executionsTable).values({
        id: record.id,
        traceId: record.traceId,
        workflowId: record.workflowId,
        workflowVersionId: record.workflowVersionId,
        definitionSnapshot: record.definitionSnapshot,
        status: record.status,
        mode: record.mode,
        environment: record.environment,
        idempotencyKey: record.idempotencyKey,
        sessionId: record.sessionId,
        createdAt: now,
      });
    },

    async updateExecutionStatus(executionId: string, status: string): Promise<void> {
      const now = new Date();
      const patch: {
        status: string;
        startedAt?: Date;
        finishedAt?: Date;
      } = { status };
      if (status === 'running') {
        patch.startedAt = now;
      }
      if (status === 'success' || status === 'failed') {
        patch.finishedAt = now;
      }
      if (status === 'waiting') {
        patch.finishedAt = undefined;
      }
      await db
        .update(executionsTable)
        .set(patch)
        .where(eq(executionsTable.id, executionId));
    },

    async getExecution(executionId: string): Promise<ExecutionRow | null> {
      const rows = await db
        .select({
          id: executionsTable.id,
          traceId: executionsTable.traceId,
          workflowId: executionsTable.workflowId,
          workflowVersionId: executionsTable.workflowVersionId,
          definitionSnapshot: executionsTable.definitionSnapshot,
          status: executionsTable.status,
          mode: executionsTable.mode,
          environment: executionsTable.environment,
          sessionId: executionsTable.sessionId,
          startedAt: executionsTable.startedAt,
          finishedAt: executionsTable.finishedAt,
          createdAt: executionsTable.createdAt,
        })
        .from(executionsTable)
        .where(eq(executionsTable.id, executionId))
        .limit(1);
      return rows[0] ?? null;
    },

    async listAll(
      options: { limit?: number; offset?: number; status?: string; workflowId?: string } = {},
    ): Promise<{ items: ExecutionListRow[]; total: number }> {
      const limit = Math.min(options.limit ?? 50, 200);
      const offset = options.offset ?? 0;
      const conditions = [];
      if (options.workflowId) {
        conditions.push(eq(executionsTable.workflowId, options.workflowId));
      }
      if (options.status) {
        conditions.push(eq(executionsTable.status, options.status));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(executionsTable);
      const countRows = whereClause
        ? await countQuery.where(whereClause)
        : await countQuery;
      const total = Number(countRows[0]?.count ?? 0);

      const baseQuery = db
        .select({
          id: executionsTable.id,
          traceId: executionsTable.traceId,
          workflowId: executionsTable.workflowId,
          workflowVersionId: executionsTable.workflowVersionId,
          definitionSnapshot: executionsTable.definitionSnapshot,
          status: executionsTable.status,
          mode: executionsTable.mode,
          environment: executionsTable.environment,
          startedAt: executionsTable.startedAt,
          finishedAt: executionsTable.finishedAt,
          createdAt: executionsTable.createdAt,
          workflowName: workflowsTable.name,
        })
        .from(executionsTable)
        .innerJoin(workflowsTable, eq(executionsTable.workflowId, workflowsTable.id))
        .orderBy(desc(executionsTable.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = whereClause ? await baseQuery.where(whereClause) : await baseQuery;
      return { items: rows, total };
    },

    async listByWorkflowId(
      workflowId: string,
      options: { limit?: number; offset?: number; status?: string } = {},
    ): Promise<{ items: ExecutionRow[]; total: number }> {
      const limit = Math.min(options.limit ?? 50, 200);
      const offset = options.offset ?? 0;
      const conditions = [eq(executionsTable.workflowId, workflowId)];
      if (options.status) {
        conditions.push(eq(executionsTable.status, options.status));
      }
      const whereClause = and(...conditions);

      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(executionsTable)
        .where(whereClause);
      const total = Number(countRows[0]?.count ?? 0);

      const rows = await db
        .select({
          id: executionsTable.id,
          traceId: executionsTable.traceId,
          workflowId: executionsTable.workflowId,
          workflowVersionId: executionsTable.workflowVersionId,
          definitionSnapshot: executionsTable.definitionSnapshot,
          status: executionsTable.status,
          mode: executionsTable.mode,
          environment: executionsTable.environment,
          startedAt: executionsTable.startedAt,
          finishedAt: executionsTable.finishedAt,
          createdAt: executionsTable.createdAt,
        })
        .from(executionsTable)
        .where(whereClause)
        .orderBy(desc(executionsTable.createdAt))
        .limit(limit)
        .offset(offset);

      return { items: rows, total };
    },
  };
}
