import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createMcpToolHandler } from '@rxwf/mcp-server';
import { createChatBotMcpHandlers } from '../mcp/chat-bot-mcp.js';
import { createSkillMcpHandlers, SKILL_MCP_TOOL_NAMES } from '../mcp/skill-mcp-handlers.js';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { createLiteRunnerRepository, createLiteWorkflowRepository } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import type { ExecutionRuntime } from '../execution/create-execution-runtime.js';
import { definitionFromSnapshot } from '../execution/create-execution-runtime.js';
import { createRunnerRegistrationService } from '../runners/registration-service.js';

type McpAuthContext = { userId: string; role: string };

export function registerMcpRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  executionRuntime: ExecutionRuntime,
): void {
  const workflowService = createWorkflowService(createLiteWorkflowRepository(db));
  const chatBotMcp = createChatBotMcpHandlers();
  const skillMcp = createSkillMcpHandlers(db);
  const runnerRepo = createLiteRunnerRepository(db);
  const registrationService = createRunnerRegistrationService({ db });
  let mcpAuth: McpAuthContext | null = null;

  const handler = createMcpToolHandler({
    listWorkflows: async () => workflowService.list(),
    getWorkflow: async (id) => {
      const wf = await workflowService.get(id);
      return wf ? { id: wf.id, definition: wf.definition, status: wf.status } : null;
    },
    createWorkflow: async (name, definition) => workflowService.create({ name, definition }),
    updateWorkflow: async (id, definition) => {
      await workflowService.update(id, definition);
    },
    validate: async (definition) => {
      const result = await workflowService.validate(definition);
      if (result.ok) return { ok: true, errors: [] };
      return { ok: false, errors: result.errors };
    },
    executeWorkflow: async (workflowId) => {
      const enqueued = await executionRuntime.enqueueService.enqueue({
        workflowId,
        triggerType: 'mcp',
        mode: 'manual',
      });
      const stored = await executionRuntime.executionRepo.getExecution(enqueued.executionId);
      if (stored) {
        const definition = definitionFromSnapshot(stored.definitionSnapshot);
        await executionRuntime.runner.runStoredExecution({
          executionId: enqueued.executionId,
          definition,
          mode: 'manual',
        });
      }
      const final = await executionRuntime.executionRepo.getExecution(enqueued.executionId);
      return {
        executionId: enqueued.executionId,
        status: final?.status ?? enqueued.status,
      };
    },
    getExecution: async (id) => {
      const row = await executionRuntime.executionRepo.getExecution(id);
      if (!row) return null;
      const nodeRuns = await executionRuntime.nodeRunRepo.listByExecutionId(id);
      return {
        id: row.id,
        status: row.status,
        nodeRuns: nodeRuns.map((nr) => ({ nodeId: nr.nodeId, status: nr.status })),
      };
    },
    listExecutions: async (workflowId) => {
      const { items } = await executionRuntime.executionRepo.listByWorkflowId(workflowId, {
        limit: 50,
      });
      return items.map((i) => ({ id: i.id, status: i.status }));
    },
    listRunners: async () => {
      const list = await runnerRepo.listAll();
      return list.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        platform: r.platform,
        status: r.status,
        labels: r.labels ?? [],
        agentVersion: r.agentVersion ?? null,
        lastHeartbeatAt: r.lastHeartbeatAt?.toISOString() ?? null,
      }));
    },
    createRunnerRegistrationToken: async (opts) => {
      if (!mcpAuth || mcpAuth.role !== 'admin') {
        throw new Error('Admin required');
      }
      const result = await registrationService.createRegistrationToken(mcpAuth.userId, opts);
      return {
        registrationToken: result.registrationToken,
        expiresAt: result.expiresAt.toISOString(),
      };
    },
    listExtraTools: async () => {
      const chat = (await chatBotMcp.listExtraTools?.()) ?? [];
      const skill = await skillMcp.listExtraTools();
      return [...chat, ...skill];
    },
    callExtraTool: async (name, args) => {
      if ((SKILL_MCP_TOOL_NAMES as readonly string[]).includes(name)) {
        return skillMcp.callExtraTool(name, args);
      }
      if (!chatBotMcp.callExtraTool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return chatBotMcp.callExtraTool(name, args);
    },
  });

  app.post(
    '/mcp/tools/call',
    { preHandler: authPreHandler },
    async (request) => {
      const body = request.body as { name: string; arguments?: Record<string, unknown> };
      mcpAuth = request.auth
        ? { userId: request.auth.userId, role: request.auth.role }
        : null;
      try {
        return await handler.callTool({
          name: body.name,
          arguments: body.arguments ?? {},
        });
      } finally {
        mcpAuth = null;
      }
    },
  );

  app.get('/mcp/tools', { preHandler: authPreHandler }, async () => ({
    tools: await handler.listTools(),
  }));
}
