import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WorkflowDefinition } from '@rxwf/workflow';
import type { WorkflowItem } from '@rxwf/shared';
import type { WorkflowAccessService } from '@rxwf/identity';
import {
  cancelWebhookListen,
  getWebhookListenSession,
  pollWebhookListenEvents,
  startWebhookListen,
} from '../webhook/webhook-listen-registry.js';

export function registerWebhookListenRoutes(
  app: FastifyInstance,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  workflowAccess: WorkflowAccessService,
): void {
  app.post(
    '/api/workflows/:workflowId/webhook-listen',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      if (!request.auth?.userId) {
        return reply.status(401).send({ code: 'E1002', message: 'Unauthorized' });
      }
      try {
        await workflowAccess.assertCanView(workflowId, request.auth);
      } catch (err) {
        return sendAccessError(reply, err);
      }

      const body = request.body as {
        webhookNodeId?: string;
        targetNodeId?: string;
        webhookPath?: string;
        definition?: WorkflowDefinition;
        pinData?: Record<string, WorkflowItem[]>;
        pinBranchData?: Record<string, WorkflowItem[][]>;
      };

      if (
        !body?.webhookNodeId ||
        !body.targetNodeId ||
        !body.webhookPath ||
        !body.definition
      ) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'webhookNodeId, targetNodeId, webhookPath and definition are required',
        });
      }

      const session = startWebhookListen({
        workflowId,
        webhookNodeId: body.webhookNodeId,
        webhookPath: body.webhookPath,
        targetNodeId: body.targetNodeId,
        definition: body.definition,
        pinData: body.pinData,
        pinBranchData: body.pinBranchData,
        userId: request.auth.userId,
      });

      return {
        listenId: session.listenId,
        expiresAt: session.expiresAt,
        status: session.status,
      };
    },
  );

  app.get(
    '/api/workflows/:workflowId/webhook-listen/:listenId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId, listenId } = request.params as {
        workflowId: string;
        listenId: string;
      };
      const auth = request.auth;
      if (!auth?.userId) {
        return reply.status(401).send({ code: 'E1002', message: 'Unauthorized' });
      }
      try {
        await workflowAccess.assertCanView(workflowId, auth);
      } catch (err) {
        return sendAccessError(reply, err);
      }

      const session = getWebhookListenSession(listenId);
      if (!session || session.workflowId !== workflowId) {
        return reply.status(404).send({ code: 'E1001', message: 'Listen session not found' });
      }
      if (session.userId !== auth.userId) {
        return reply.status(403).send({ code: 'E1002', message: 'Forbidden' });
      }

      const fromIndex = Number((request.query as { from?: string }).from ?? 0);
      const polled = pollWebhookListenEvents(listenId, fromIndex);
      if (!polled) {
        return reply.status(404).send({ code: 'E1001', message: 'Listen session not found' });
      }

      return {
        listenId,
        status: polled.status,
        events: polled.events,
        nextIndex: polled.nextIndex,
      };
    },
  );

  app.delete(
    '/api/workflows/:workflowId/webhook-listen/:listenId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId, listenId } = request.params as {
        workflowId: string;
        listenId: string;
      };
      const auth = request.auth;
      if (!auth?.userId) {
        return reply.status(401).send({ code: 'E1002', message: 'Unauthorized' });
      }
      try {
        await workflowAccess.assertCanView(workflowId, auth);
      } catch (err) {
        return sendAccessError(reply, err);
      }

      const session = getWebhookListenSession(listenId);
      if (!session || session.workflowId !== workflowId) {
        return reply.status(404).send({ code: 'E1001', message: 'Listen session not found' });
      }
      if (session.userId !== auth.userId) {
        return reply.status(403).send({ code: 'E1002', message: 'Forbidden' });
      }

      cancelWebhookListen(listenId);
      return { ok: true };
    },
  );
}

function sendAccessError(reply: FastifyReply, err: unknown) {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : 'E1002';
  const status = code === 'E1001' ? 404 : 403;
  return reply.status(status).send({ code });
}
