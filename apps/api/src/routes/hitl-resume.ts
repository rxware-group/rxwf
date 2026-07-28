import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AwfError } from '@rxwf/shared';
import type { ExecutionRuntime } from '../execution/create-execution-runtime.js';

export interface HitlResumeBody {
  nodeId?: string;
  decision?: 'approve' | 'reject';
  comment?: string;
  supplement?: string;
}

export interface GroupChatOrchestrationResume {
  kind: 'groupChat';
  checkpoint: Record<string, unknown>;
  userMessage: string;
}

export function mapHitlResumeError(
  err: unknown,
): { status: number; code: string; message: string } | null {
  if (err instanceof AwfError) {
    if (err.code === 'E1001') {
      return { status: 404, code: err.code, message: err.message };
    }
    return { status: 400, code: err.code, message: err.message };
  }
  return null;
}

export function parseGroupChatCheckpointFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const gc = metadata?.groupChat;
  if (!gc || typeof gc !== 'object') return null;
  const cp = (gc as { checkpoint?: unknown }).checkpoint;
  if (!cp || typeof cp !== 'object') return null;
  const c = cp as {
    transcript?: unknown;
    round?: unknown;
    task?: unknown;
    memberIds?: unknown;
  };
  if (
    !Array.isArray(c.transcript) ||
    typeof c.round !== 'number' ||
    typeof c.task !== 'string' ||
    !Array.isArray(c.memberIds)
  ) {
    return null;
  }
  return cp as Record<string, unknown>;
}

export function validateGroupChatUserProxySupplement(input: {
  decision: 'approve' | 'reject';
  supplement?: string;
}): void {
  if (input.decision === 'reject') return;
  const message = input.supplement?.trim() ?? '';
  if (!message) {
    throw new AwfError(
      'E3014',
      'UserProxy resume requires a non-empty supplement to append user message',
    );
  }
}

export function buildGroupChatOrchestrationResume(
  checkpoint: Record<string, unknown>,
  input: { decision: 'approve' | 'reject'; supplement?: string },
): GroupChatOrchestrationResume {
  validateGroupChatUserProxySupplement(input);
  return {
    kind: 'groupChat',
    checkpoint,
    userMessage: input.supplement!.trim(),
  };
}

/** Validates groupChat UserProxy resume and builds orchestrationResume payload at API layer. */
export async function prepareGroupChatHitlResume(
  executionRuntime: ExecutionRuntime,
  executionId: string,
  input: { decision: 'approve' | 'reject'; supplement?: string },
): Promise<GroupChatOrchestrationResume | null> {
  const waitingRun = await executionRuntime.nodeRunRepo.findWaitingByExecution(executionId);
  if (!waitingRun || waitingRun.nodeType !== 'groupChat') return null;

  const checkpoint = parseGroupChatCheckpointFromMetadata(waitingRun.metadata);
  if (!checkpoint) return null;

  validateGroupChatUserProxySupplement({
    decision: input.decision,
    supplement: input.supplement,
  });

  if (input.decision === 'approve') {
    return buildGroupChatOrchestrationResume(checkpoint, {
      decision: input.decision,
      supplement: input.supplement,
    });
  }
  return null;
}

export function registerHitlResumeRoutes(
  app: FastifyInstance,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  executionRuntime: ExecutionRuntime,
): void {
  app.post(
    '/api/executions/:executionId/hitl/resume',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const body = request.body as HitlResumeBody;
      if (body.decision !== 'approve' && body.decision !== 'reject') {
        return reply.status(400).send({
          code: 'E2003',
          message: 'decision must be approve or reject',
        });
      }
      try {
        const row = await executionRuntime.executionRepo.getExecution(executionId);
        if (!row) {
          return reply.status(404).send({ code: 'E1001', message: 'Execution not found' });
        }

        await prepareGroupChatHitlResume(executionRuntime, executionId, {
          decision: body.decision,
          supplement: body.supplement,
        });

        const result = await executionRuntime.resumeHitl({
          executionId,
          nodeId: body.nodeId,
          decision: body.decision,
          comment: body.comment,
          supplement: body.supplement,
        });
        return reply.send(result);
      } catch (err) {
        const mapped = mapHitlResumeError(err);
        if (mapped) {
          return reply.status(mapped.status).send({
            code: mapped.code,
            message: mapped.message,
          });
        }
        throw err;
      }
    },
  );
}
