import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AwfError } from '@rxwf/shared';
import {
  createUserService,
  type WorkflowAccessService,
  type WorkflowRole,
} from '@rxwf/identity';
import type {
  WorkflowCollaboratorRepository,
} from '@rxwf/providers-lite';
import type { createWorkflowService } from '@rxwf/workflow';
import type { createAuthPreHandler } from '../middleware/auth.js';

export interface WorkflowCollaboratorRouteDeps {
  workflowService: ReturnType<typeof createWorkflowService>;
  collaboratorRepo: WorkflowCollaboratorRepository;
  workflowAccess: WorkflowAccessService;
  users: ReturnType<typeof createUserService>;
}

export function registerWorkflowCollaboratorRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
  deps: WorkflowCollaboratorRouteDeps,
): void {
  const { workflowService, collaboratorRepo, workflowAccess, users } = deps;

  async function withShareAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    workflowId: string,
    handler: () => Promise<unknown>,
  ) {
    try {
      await workflowAccess.assertCanShare(workflowId, request.auth!);
    } catch (err) {
      return sendAccessError(reply, err);
    }
    return handler();
  }

  async function withViewAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    workflowId: string,
    handler: () => Promise<unknown>,
  ) {
    try {
      await workflowAccess.assertCanView(workflowId, request.auth!);
    } catch (err) {
      return sendAccessError(reply, err);
    }
    return handler();
  }

  app.get(
    '/api/workflows/:workflowId/collaborators',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withViewAccess(request, reply, workflowId, async () => {
        const meta = await workflowService.getMeta(workflowId);
        if (!meta) {
          return reply.status(404).send({ code: 'E1001', message: 'Workflow not found' });
        }
        const collaborators = await collaboratorRepo.list(workflowId);
        let creatorEmail: string | null = null;
        if (meta.createdByUserId) {
          const creator = await users.findById(meta.createdByUserId);
          creatorEmail = creator?.email ?? null;
        }
        return {
          creatorUserId: meta.createdByUserId,
          creatorEmail,
          collaborators: collaborators.map((c) => ({
            userId: c.userId,
            email: c.email,
            role: c.role,
            createdAt: c.createdAt.toISOString(),
          })),
        };
      });
    },
  );

  app.put(
    '/api/workflows/:workflowId/collaborators',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withShareAccess(request, reply, workflowId, async () => {
        const meta = await workflowService.getMeta(workflowId);
        if (!meta) {
          return reply.status(404).send({ code: 'E1001', message: 'Workflow not found' });
        }

        const body = (request.body ?? {}) as {
          collaborators?: Array<{ userId?: string; role?: WorkflowRole }>;
        };
        if (!Array.isArray(body.collaborators)) {
          return reply.status(400).send({ code: 'E1001', message: 'collaborators array required' });
        }

        const desired = new Map<string, WorkflowRole>();
        for (const entry of body.collaborators) {
          const userId = String(entry.userId ?? '').trim();
          const role = entry.role;
          if (!userId || !role || !['owner', 'editor', 'viewer'].includes(role)) {
            return reply.status(400).send({ code: 'E1001', message: 'Invalid collaborator entry' });
          }
          if (meta.createdByUserId && userId === meta.createdByUserId) {
            continue;
          }
          desired.set(userId, role);
        }

        const current = await collaboratorRepo.list(workflowId);
        for (const [userId, role] of desired) {
          await collaboratorRepo.upsert(workflowId, userId, role);
        }
        for (const row of current) {
          if (meta.createdByUserId && row.userId === meta.createdByUserId) {
            continue;
          }
          if (!desired.has(row.userId)) {
            await collaboratorRepo.remove(workflowId, row.userId);
          }
        }

        const collaborators = await collaboratorRepo.list(workflowId);
        let creatorEmail: string | null = null;
        if (meta.createdByUserId) {
          const creator = await users.findById(meta.createdByUserId);
          creatorEmail = creator?.email ?? null;
        }
        return {
          creatorUserId: meta.createdByUserId,
          creatorEmail,
          collaborators: collaborators.map((c) => ({
            userId: c.userId,
            email: c.email,
            role: c.role,
            createdAt: c.createdAt.toISOString(),
          })),
        };
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId/collaborators/candidates',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withShareAccess(request, reply, workflowId, async () => {
        const rows = await users.listUsers();
        return {
          users: rows
            .filter((u) => u.status === 'active')
            .map((u) => ({ id: u.id, email: u.email })),
        };
      });
    },
  );
}

function awfErrorStatus(code: string): number {
  if (code === 'E1001') return 404;
  if (code === 'E1003') return 403;
  if (code === 'E4003') return 403;
  if (code === 'E1040') return 409;
  return 400;
}

function sendAccessError(reply: FastifyReply, err: unknown) {
  if (err instanceof AwfError) {
    return reply.status(awfErrorStatus(err.code)).send({ code: err.code, message: err.message });
  }
  throw err;
}
