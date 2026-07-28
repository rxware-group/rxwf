import { asc, eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { nodeRuns as nodeRunsTable } from './drizzle/schema.js';

export interface NodeRunPendingRecord {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
}

export interface NodeRunFinishRecord {
  id: string;
  status: 'success' | 'failed' | 'skipped' | 'waiting';
  durationMs: number;
  runnerId?: string;
  runnerPlatform?: { os: string; arch: string };
  errorCode?: string;
  outputData?: unknown[][] | null;
  metadata?: Record<string, unknown> | null;
}

export interface NodeRunRow {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  durationMs: number | null;
  runnerId: string | null;
  runnerPlatform: { os: string; arch: string } | null;
  errorCode: string | null;
  outputData: unknown[][] | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export function createLiteNodeRunRepository(db: LiteDatabase) {
  return {
    async insertPending(record: NodeRunPendingRecord): Promise<void> {
      await db.insert(nodeRunsTable).values({
        id: record.id,
        executionId: record.executionId,
        nodeId: record.nodeId,
        nodeType: record.nodeType,
        status: 'running',
        attempt: 0,
        createdAt: new Date(),
      });
    },

    async patchMetadata(
      id: string,
      metadata: Record<string, unknown>,
    ): Promise<void> {
      await db
        .update(nodeRunsTable)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(nodeRunsTable.id, id));
    },

    async finish(record: NodeRunFinishRecord): Promise<void> {
      await db
        .update(nodeRunsTable)
        .set({
          status: record.status,
          durationMs: record.durationMs,
          runnerId: record.runnerId,
          runnerPlatform: record.runnerPlatform
            ? JSON.stringify(record.runnerPlatform)
            : null,
          errorCode: record.errorCode,
          outputData:
            record.outputData !== undefined && record.outputData !== null
              ? JSON.stringify(record.outputData)
              : null,
          metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        })
        .where(eq(nodeRunsTable.id, record.id));
    },

    async resumeFromWaiting(record: {
      id: string;
      status: 'success' | 'failed';
      outputData?: unknown[][] | null;
      metadata?: Record<string, unknown> | null;
      errorCode?: string;
      durationMs?: number;
    }): Promise<void> {
      await db
        .update(nodeRunsTable)
        .set({
          status: record.status,
          durationMs: record.durationMs,
          errorCode: record.errorCode ?? null,
          outputData:
            record.outputData !== undefined && record.outputData !== null
              ? JSON.stringify(record.outputData)
              : null,
          metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        })
        .where(eq(nodeRunsTable.id, record.id));
    },

    async findWaitingByExecution(executionId: string): Promise<NodeRunRow | null> {
      const rows = await db
        .select()
        .from(nodeRunsTable)
        .where(eq(nodeRunsTable.executionId, executionId));
      const waiting = rows.find((r) => r.status === 'waiting');
      if (!waiting) return null;
      return {
        id: waiting.id,
        executionId: waiting.executionId,
        nodeId: waiting.nodeId,
        nodeType: waiting.nodeType,
        status: waiting.status,
        durationMs: waiting.durationMs,
        runnerId: waiting.runnerId,
        runnerPlatform: waiting.runnerPlatform
          ? (JSON.parse(waiting.runnerPlatform) as { os: string; arch: string })
          : null,
        errorCode: waiting.errorCode,
        outputData: waiting.outputData
          ? (JSON.parse(waiting.outputData) as unknown[][])
          : null,
        metadata: waiting.metadata
          ? (JSON.parse(waiting.metadata) as Record<string, unknown>)
          : null,
        createdAt: waiting.createdAt,
      };
    },

    async listByExecutionId(executionId: string): Promise<NodeRunRow[]> {
      const rows = await db
        .select()
        .from(nodeRunsTable)
        .where(eq(nodeRunsTable.executionId, executionId))
        .orderBy(asc(nodeRunsTable.createdAt), asc(nodeRunsTable.id));
      return rows.map((row) => ({
        id: row.id,
        executionId: row.executionId,
        nodeId: row.nodeId,
        nodeType: row.nodeType,
        status: row.status,
        durationMs: row.durationMs,
        runnerId: row.runnerId,
        runnerPlatform: row.runnerPlatform
          ? (JSON.parse(row.runnerPlatform) as { os: string; arch: string })
          : null,
        errorCode: row.errorCode,
        outputData: row.outputData
          ? (JSON.parse(row.outputData) as unknown[][])
          : null,
        metadata: row.metadata
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : null,
        createdAt: row.createdAt,
      }));
    },
  };
}
