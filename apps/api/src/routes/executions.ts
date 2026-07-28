import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WorkflowItem } from '@rxwf/shared';
import { AwfError } from '@rxwf/shared';
import { buildDebugPinData } from '@rxwf/execution';
import {
  definitionFromSnapshot,
  type ExecutionRuntime,
} from '../execution/create-execution-runtime.js';

function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function toExecutionSummary(row: {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: string;
  mode: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  workflowName?: string;
}) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    workflowVersionId: row.workflowVersionId,
    workflowName: row.workflowName,
    status: row.status,
    mode: row.mode,
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
  };
}

export function registerExecutionRoutes(
  app: FastifyInstance,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  executionRuntime: ExecutionRuntime,
): void {
  app.get(
    '/api/executions',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const query = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
        workflowId?: string;
      };
      const limit = query.limit ? Number(query.limit) : 50;
      const offset = query.offset ? Number(query.offset) : 0;
      const { items, total } = await executionRuntime.executionRepo.listAll({
        limit,
        offset,
        status: query.status,
        workflowId: query.workflowId,
      });
      return reply.send({
        items: items.map(toExecutionSummary),
        total,
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId/executions',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const query = request.query as {
        limit?: string;
        offset?: string;
        status?: string;
      };
      const limit = query.limit ? Number(query.limit) : 50;
      const offset = query.offset ? Number(query.offset) : 0;
      const { items, total } = await executionRuntime.executionRepo.listByWorkflowId(
        workflowId,
        { limit, offset, status: query.status },
      );
      return reply.send({
        items: items.map(toExecutionSummary),
        total,
      });
    },
  );

  app.get(
    '/api/executions/:executionId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const row = await executionRuntime.executionRepo.getExecution(executionId);
      if (!row) {
        return reply.status(404).send({ code: 'E1001', message: 'Execution not found' });
      }
      const nodeRuns = await executionRuntime.nodeRunRepo.listByExecutionId(executionId);
      return {
        ...toExecutionSummary(row),
        traceId: row.traceId,
        definitionSnapshot: definitionFromSnapshot(row.definitionSnapshot),
        nodeRuns: nodeRuns.map((nr) => ({
          nodeId: nr.nodeId,
          nodeType: nr.nodeType,
          status: nr.status,
          errorCode: nr.errorCode ?? undefined,
          durationMs: nr.durationMs ?? undefined,
          runnerId: nr.runnerId ?? undefined,
          runnerPlatform: nr.runnerPlatform ?? undefined,
          outputData: nr.outputData ?? undefined,
          metadata: nr.metadata ?? undefined,
        })),
      };
    },
  );

  app.get(
    '/api/executions/:executionId/debug-pin-data',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const row = await executionRuntime.executionRepo.getExecution(executionId);
      if (!row) {
        return reply.status(404).send({ code: 'E1001', message: 'Execution not found' });
      }
      const nodeRuns = await executionRuntime.nodeRunRepo.listByExecutionId(executionId);
      const definition = definitionFromSnapshot(row.definitionSnapshot);
      const mapped = nodeRuns.map((nr) => ({
        nodeId: nr.nodeId,
        status: nr.status,
        outputData: (nr.outputData as WorkflowItem[][] | null) ?? null,
      }));
      const hasAnyOutput = mapped.some((r) => r.outputData && r.outputData.length > 0);
      if (!hasAnyOutput) {
        return reply.status(400).send({
          code: 'E1020',
          message: '该执行无可用输出数据',
        });
      }
      const { pinData, failedNodeId, skippedNodeIds } = buildDebugPinData(
        definition,
        mapped,
      );
      return {
        sourceExecutionId: executionId,
        failedNodeId,
        skippedNodeIds,
        pinData,
      };
    },
  );

  app.post(
    '/api/executions/:executionId/hitl/resume',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const body = request.body as {
        nodeId?: string;
        decision?: 'approve' | 'reject';
        comment?: string;
        supplement?: string;
      };
      if (body.decision !== 'approve' && body.decision !== 'reject') {
        return reply.status(400).send({
          code: 'E2003',
          message: 'decision must be approve or reject',
        });
      }
      try {
        const result = await executionRuntime.resumeHitl({
          executionId,
          nodeId: body.nodeId,
          decision: body.decision,
          comment: body.comment,
          supplement: body.supplement,
        });
        return reply.send(result);
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
