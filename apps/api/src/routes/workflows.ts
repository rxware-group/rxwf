import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AwfError } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';
import {
  createWorkflowService,
  findSubworkflowTriggerNode,
  resolveSubworkflowInputSchema,
} from '@rxwf/workflow';
import {
  createUserService,
  type WorkflowAccessService,
  type WorkflowRole,
} from '@rxwf/identity';
import type {
  LiteDatabase,
  WorkflowCollaboratorRepository,
} from '@rxwf/providers-lite';
import {
  definitionFromSnapshot,
  type ExecutionRuntime,
} from '../execution/create-execution-runtime.js';

type AccessRole = WorkflowRole | 'admin';

export interface WorkflowRouteDeps {
  collaboratorRepo: WorkflowCollaboratorRepository;
  workflowAccess: WorkflowAccessService;
  liteDb: LiteDatabase;
}

export function registerWorkflowRoutes(
  app: FastifyInstance,
  workflowService: ReturnType<typeof createWorkflowService>,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  executionRuntime: ExecutionRuntime,
  deps: WorkflowRouteDeps,
): void {
  const { collaboratorRepo, workflowAccess } = deps;
  const users = createUserService(deps.liteDb);

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

  async function withEditAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    workflowId: string,
    handler: () => Promise<unknown>,
  ) {
    try {
      await workflowAccess.assertCanEdit(workflowId, request.auth!);
    } catch (err) {
      return sendAccessError(reply, err);
    }
    return handler();
  }

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

  async function resolveAccessRole(
    workflowId: string,
    request: FastifyRequest,
  ): Promise<AccessRole | null> {
    return workflowAccess.resolveAccess(workflowId, request.auth!);
  }

  async function attachAccessRoles<T extends { id: string }>(
    workflows: T[],
    request: FastifyRequest,
  ): Promise<Array<T & { accessRole: AccessRole | null }>> {
    return Promise.all(
      workflows.map(async (workflow) => ({
        ...workflow,
        accessRole: await resolveAccessRole(workflow.id, request),
      })),
    );
  }

  function serializeWorkflowListItem<T extends { description?: unknown; createdAt?: unknown; updatedAt?: unknown; createdByEmail?: unknown; createdByNickname?: unknown }>(workflow: T) {
    const createdAt = workflow.createdAt;
    const updatedAt = workflow.updatedAt;
    return {
      ...workflow,
      description: typeof workflow.description === 'string' ? workflow.description : '',
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : typeof createdAt === 'string'
            ? createdAt
            : null,
      updatedAt:
        updatedAt instanceof Date
          ? updatedAt.toISOString()
          : typeof updatedAt === 'string'
            ? updatedAt
            : null,
      createdByEmail:
        typeof workflow.createdByEmail === 'string' ? workflow.createdByEmail : null,
      createdByNickname:
        typeof workflow.createdByNickname === 'string' ? workflow.createdByNickname : null,
    };
  }

  async function listWorkflowsResponse(
    request: FastifyRequest,
    listOptions?: { ids?: string[]; kind?: 'agent' | 'automation' },
  ) {
    const workflows = await attachAccessRoles(
      await workflowService.list(listOptions),
      request,
    );
    return { workflows: workflows.map(serializeWorkflowListItem) };
  }

  app.get(
    '/api/workflows',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const auth = request.auth!;
      const query = request.query as {
        scope?: string;
        exposeAsTool?: string;
        kind?: string;
      };
      const scopeParam = query.scope;
      const exposeAsToolOnly = query.exposeAsTool === 'true';
      const kindFilter: 'agent' | 'automation' | undefined =
        query.kind === 'agent' || query.kind === 'automation' ? query.kind : undefined;
      let ids: string[] | undefined;

      const listOpts = (ids?: string[]): { ids?: string[]; kind?: 'agent' | 'automation' } => ({
        ids,
        kind: kindFilter,
      });

      if (exposeAsToolOnly) {
        if (scopeParam === 'all') {
          if (auth.role !== 'admin') {
            return reply.status(403).send({ code: 'E1003', message: 'Admin required' });
          }
          const workflows = await attachAccessRoles(
            await workflowService.listExposedAsTools(),
            request,
          );
          return { workflows };
        }
        if (scopeParam === 'mine' || scopeParam === 'shared') {
          ids = await collaboratorRepo.listWorkflowIdsForUser(auth.userId, scopeParam);
        } else if (scopeParam !== undefined) {
          return reply.status(400).send({ code: 'E1001', message: 'Invalid scope' });
        } else if (auth.role === 'admin') {
          const workflows = await attachAccessRoles(
            await workflowService.listExposedAsTools(),
            request,
          );
          return { workflows };
        } else {
          const mineIds = await collaboratorRepo.listWorkflowIdsForUser(auth.userId, 'mine');
          const sharedIds = await collaboratorRepo.listWorkflowIdsForUser(
            auth.userId,
            'shared',
          );
          ids = [...new Set([...mineIds, ...sharedIds])];
        }
        let exposed = await workflowService.listExposedAsTools({ ids });
        if (kindFilter) {
          exposed = exposed.filter((w) => w.workflowKind === kindFilter);
        }
        const workflows = await attachAccessRoles(exposed, request);
        return { workflows };
      }

      if (scopeParam === 'all') {
        if (auth.role !== 'admin') {
          return reply.status(403).send({ code: 'E1003', message: 'Admin required' });
        }
        return listWorkflowsResponse(request, listOpts());
      }

      if (scopeParam === 'mine' || scopeParam === 'shared') {
        ids = await collaboratorRepo.listWorkflowIdsForUser(auth.userId, scopeParam);
      } else if (scopeParam !== undefined) {
        return reply.status(400).send({ code: 'E1001', message: 'Invalid scope' });
      } else if (auth.role === 'admin') {
        return listWorkflowsResponse(request, listOpts());
      } else {
        const mineIds = await collaboratorRepo.listWorkflowIdsForUser(auth.userId, 'mine');
        const sharedIds = await collaboratorRepo.listWorkflowIdsForUser(auth.userId, 'shared');
        ids = [...new Set([...mineIds, ...sharedIds])];
      }

      return listWorkflowsResponse(request, listOpts(ids));
    },
  );

  app.post(
    '/api/workflows',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        description?: string;
        definition?: WorkflowDefinition;
      };
      if (!body?.name || !body?.definition) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'name and definition are required',
        });
      }
      try {
        const created = await workflowService.create({
          name: body.name,
          description: body.description,
          definition: body.definition,
          createdByUserId: request.auth!.userId,
        });
        return reply.status(201).send(created);
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.patch(
    '/api/workflows/:workflowId/meta',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withEditAccess(request, reply, workflowId, async () => {
        const body = request.body as { name?: string; description?: string };
        if (!body?.name?.trim()) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'name is required',
          });
        }
        try {
          const updated = await workflowService.updateMeta(workflowId, {
            name: body.name,
            description: body.description,
          });
          return updated;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.delete(
    '/api/workflows/:workflowId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          await workflowService.remove(workflowId);
          return reply.status(204).send();
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withViewAccess(request, reply, workflowId, async () => {
        const workflow = await workflowService.get(workflowId);
        if (!workflow) {
          return reply.status(404).send({ code: 'E1001', message: 'Workflow not found' });
        }
        const accessRole = await resolveAccessRole(workflowId, request);
        return { workflow: { ...workflow, accessRole } };
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId/subworkflow-input-schema',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withViewAccess(request, reply, workflowId, async () => {
        const definition = await workflowService.getPublishedDefinition(workflowId);
        if (!definition) {
          return reply.status(404).send({
            code: 'E1053',
            message: 'Published workflow definition not found',
          });
        }
        if (!findSubworkflowTriggerNode(definition)) {
          return reply.status(404).send({
            code: 'E1055',
            message: 'Workflow has no subworkflowTrigger',
          });
        }
        const schema = resolveSubworkflowInputSchema(definition);
        if (!schema) {
          return reply.status(400).send({
            code: 'E1058',
            message: 'Invalid subworkflowTrigger schema',
          });
        }
        return {
          mode: schema.mode,
          fields: schema.fields,
          jsonSchema: schema.jsonSchema,
        };
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId/published-versions',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withViewAccess(request, reply, workflowId, async () => {
        try {
          const versions = await workflowService.listPublishedVersions(workflowId);
          return {
            versions: versions.map((v) => ({
              id: v.id,
              version: v.version,
              semverLabel: v.semverLabel,
              publishNote: v.publishNote ?? undefined,
              publishedAt: v.publishedAt.toISOString(),
              publishedByUserId: v.publishedByUserId ?? undefined,
              publishedByEmail: v.publishedByEmail ?? undefined,
              isCurrent: v.isCurrent,
            })),
          };
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.get(
    '/api/workflows/:workflowId/published-versions/:version/definition',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId, version: versionStr } = request.params as {
        workflowId: string;
        version: string;
      };
      const version = Number(versionStr);
      if (!Number.isInteger(version)) {
        return reply.status(400).send({ code: 'E1001', message: 'Invalid version' });
      }
      return withViewAccess(request, reply, workflowId, async () => {
        try {
          const definition = await workflowService.getPublishedVersionDefinition(
            workflowId,
            version,
          );
          return { version, definition };
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/published-versions/:version/rollback',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId, version: versionStr } = request.params as {
        workflowId: string;
        version: string;
      };
      const version = Number(versionStr);
      if (!Number.isInteger(version)) {
        return reply.status(400).send({ code: 'E1001', message: 'Invalid version' });
      }
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          const rolled = await workflowService.rollbackPublish(
            workflowId,
            version,
            request.auth!.userId,
          );
          return rolled;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/published-versions/:version/restore-draft',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId, version: versionStr } = request.params as {
        workflowId: string;
        version: string;
      };
      const version = Number(versionStr);
      if (!Number.isInteger(version)) {
        return reply.status(400).send({ code: 'E1001', message: 'Invalid version' });
      }
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          const restored = await workflowService.restoreDraftFromPublished(
            workflowId,
            version,
            request.auth!.userId,
          );
          return restored;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.put(
    '/api/workflows/:workflowId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const body = request.body as {
        definition?: WorkflowDefinition;
      };
      if (!body?.definition) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'definition is required',
        });
      }
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          const updated = await workflowService.update(workflowId, body.definition as WorkflowDefinition);
          return updated;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/publish',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const body = (request.body ?? {}) as { publishNote?: string };
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          const result = await workflowService.publish(
            workflowId,
            request.auth!.userId,
            body.publishNote,
          );
          return result;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/unpublish',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withEditAccess(request, reply, workflowId, async () => {
        try {
          const result = await workflowService.unpublish(workflowId, request.auth!.userId);
          return result;
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/executions',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const body = request.body as {
        mode?: 'manual' | 'production';
        environment?: 'test' | 'prod';
        sessionId?: string;
      };
      return withViewAccess(request, reply, workflowId, async () => {
        const workflow = await workflowService.get(workflowId);
        if (!workflow) {
          return reply.status(404).send({ code: 'E1001', message: 'Workflow not found' });
        }
        try {
          const enqueued = await executionRuntime.enqueueService.enqueue({
            workflowId,
            triggerType: 'manual',
            mode: body?.mode ?? 'manual',
            environment: body?.environment,
            sessionId: body?.sessionId,
          });
          const stored = await executionRuntime.executionRepo.getExecution(
            enqueued.executionId,
          );
          if (stored) {
            const definition = definitionFromSnapshot(stored.definitionSnapshot);
            const env = await executionRuntime.resolveExecutionEnv(
              workflowId,
              stored.environment,
            );
            await executionRuntime.runner.runStoredExecution({
              executionId: enqueued.executionId,
              definition,
              mode: stored.mode as 'manual' | 'production',
              env,
              workflowId,
              sessionId: body?.sessionId ?? stored.sessionId ?? undefined,
            });
          }
          const finalRow = await executionRuntime.executionRepo.getExecution(
            enqueued.executionId,
          );
          return reply.status(202).send({
            executionId: enqueued.executionId,
            status: finalRow?.status ?? enqueued.status,
            version: enqueued.version,
          });
        } catch (err) {
          return sendAwfError(reply, err);
        }
      });
    },
  );

  app.post(
    '/api/workflows/:workflowId/validate',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withViewAccess(request, reply, workflowId, async () => {
        const body = request.body as { definition?: WorkflowDefinition };
        const definition = body?.definition;
        if (!definition) {
          return { ok: false, errors: [{ code: 'E1001', message: 'definition is required' }] };
        }
        const result = await workflowService.validateToolWorkflowNodes(definition);
        if (result.ok) return { ok: true, warnings: result.warnings };
        return result;
      });
    },
  );

  app.post(
    '/api/workflows/debug-node',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = request.body as {
        definition?: WorkflowDefinition;
        targetNodeId?: string;
        pinData?: Record<string, { json: Record<string, unknown> }[]>;
        pinBranchData?: Record<string, { json: Record<string, unknown> }[][]>;
        workflowId?: string;
        environment?: 'test' | 'prod';
        stream?: boolean;
        locale?: string;
      };
      if (!body?.definition || !body.targetNodeId) {
        return reply
          .status(400)
          .send({ code: 'E1001', message: 'definition and targetNodeId are required' });
      }
      if (body.workflowId) {
        try {
          await workflowAccess.assertCanView(body.workflowId, request.auth!);
        } catch (err) {
          return sendAccessError(reply, err);
        }
      }
      const localErrors = await workflowService.validate(body.definition);
      if (!localErrors.ok) {
        return reply.status(400).send({
          code: 'E1003',
          message: localErrors.errors.map((e) => e.message).join('; '),
        });
      }
      try {
        if (body.stream) {
          reply.hijack();
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          const result = await executionRuntime.debugNode({
            definition: body.definition,
            targetNodeId: body.targetNodeId,
            pinData: body.pinData,
            pinBranchData: body.pinBranchData,
            workflowId: body.workflowId,
            environment: body.environment ?? 'test',
            locale: body.locale,
            onNodeResult: (nodeId, nodeResult) => {
              reply.raw.write(
                `data: ${JSON.stringify({ type: 'nodeResult', nodeId, nodeResult })}\n\n`,
              );
            },
            onNodeStarted: (nodeId) => {
              reply.raw.write(
                `data: ${JSON.stringify({ type: 'nodeStarted', nodeId })}\n\n`,
              );
            },
            onAgentStream: (nodeId, chunk) => {
              reply.raw.write(
                `data: ${JSON.stringify({ type: 'agentStream', nodeId, chunk })}\n\n`,
              );
            },
          });
          reply.raw.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }
        const result = await executionRuntime.debugNode({
          definition: body.definition,
          targetNodeId: body.targetNodeId,
          pinData: body.pinData,
          pinBranchData: body.pinBranchData,
          workflowId: body.workflowId,
          environment: body.environment ?? 'test',
          locale: body.locale,
        });
        return result;
      } catch (err) {
        if (body.stream && reply.raw.headersSent) {
          const code = err instanceof AwfError ? err.code : 'E2000';
          const message = err instanceof Error ? err.message : 'debug stream error';
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', code, message })}\n\n`);
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
          return;
        }
        return sendAwfError(reply, err);
      }
    },
  );

  app.get(
    '/api/workflows/:workflowId/collaborators',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      return withShareAccess(request, reply, workflowId, async () => {
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

function sendAwfError(reply: FastifyReply, err: unknown) {
  if (err instanceof AwfError) {
    return reply.status(awfErrorStatus(err.code)).send({ code: err.code, message: err.message });
  }
  throw err;
}
