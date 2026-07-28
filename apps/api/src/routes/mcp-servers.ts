import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { createMcpClientPool } from '@rxwf/mcp-client-pool';
import { AwfError } from '@rxwf/shared';
import {
  buildLaunchFromServer,
  validateDockerConfig,
  validateDockerTransport,
} from '../mcp-servers/launch.js';
import type { createMcpServerStore, McpDockerConfig, McpTransport } from '../mcp-servers/store.js';

type McpPool = ReturnType<typeof createMcpClientPool>;


function validateCreateBody(body: {
  name?: string;
  transport?: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  docker?: McpDockerConfig;
}): string | null {
  if (!body.name?.trim() || !body.transport) {
    return 'name and transport required';
  }
  if (body.transport === 'docker') {
    try {
      validateDockerTransport({
        command: body.command,
        args: body.args,
        docker: body.docker,
      });
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid docker config';
    }
  }
  if (body.transport === 'http' && !body.url?.trim()) {
    return 'url is required for http transport';
  }
  return null;
}

export function registerMcpServerRoutes(
  app: FastifyInstance,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  store: ReturnType<typeof createMcpServerStore>,
  mcpPool: McpPool,
): void {
  app.get('/api/mcp-servers', { preHandler: authPreHandler }, async () => ({
    servers: await store.list(),
  }));

  app.post('/api/mcp-servers', { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: string;
      transport?: McpTransport;
      command?: string;
      args?: string[];
      url?: string;
      docker?: McpDockerConfig;
    };
    const validationError = validateCreateBody(body);
    if (validationError) {
      return reply.status(400).send({ code: 'E1004', message: validationError });
    }
    const created = await store.create({
      name: body.name!.trim(),
      transport: body.transport!,
      command: body.command,
      args: body.args,
      url: body.url,
      docker: body.docker,
    });
    return reply.status(201).send(created);
  });

  app.put('/api/mcp-servers/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      name?: string;
      transport?: McpTransport;
      command?: string;
      args?: string[];
      url?: string;
      docker?: McpDockerConfig;
    };
    if (body.transport === 'docker') {
      try {
        validateDockerTransport({
          command: body.command,
          args: body.args,
          docker: body.docker,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid docker config';
        return reply.status(400).send({ code: 'E1004', message });
      }
    }
    try {
      const updated = await store.update(id, {
        name: body.name?.trim(),
        transport: body.transport,
        command: body.command,
        args: body.args,
        url: body.url,
        docker: body.docker,
      });
      return updated;
    } catch (err) {
      if (err instanceof AwfError && err.code === 'E1001') {
        return reply.status(404).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.delete('/api/mcp-servers/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = await store.remove(id);
    if (!removed) {
      return reply.status(404).send({ code: 'E1001', message: 'MCP server not found' });
    }
    mcpPool.release(id);
    return { ok: true };
  });

  app.post(
    '/api/mcp-servers/:id/test',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const server = await store.get(id);
      if (!server) {
        return reply.status(404).send({ code: 'E1001', message: 'MCP server not found' });
      }
      const launch = buildLaunchFromServer(server);
      if (!launch) {
        return reply.status(400).send({ code: 'E1004', message: 'Invalid MCP server config' });
      }
      try {
        const client = await mcpPool.acquire(id, launch);
        await client.listTools();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        return reply.status(502).send({ code: 'E3010', message });
      }
    },
  );

  app.get(
    '/api/mcp-servers/:id/tools',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const server = await store.get(id);
      if (!server) {
        return reply.status(404).send({ code: 'E1001', message: 'MCP server not found' });
      }
      const launch = buildLaunchFromServer(server);
      if (!launch) {
        return reply.status(400).send({ code: 'E1004', message: 'Invalid MCP server config' });
      }
      try {
        const client = await mcpPool.acquire(id, launch);
        const tools = await client.listTools();
        return { tools, source: 'mcp' as const };
      } catch (err) {
        mcpPool.release(id);
        const message = err instanceof Error ? err.message : 'Cannot list tools from MCP server';
        return reply.status(502).send({ code: 'E3010', message, tools: [] });
      }
    },
  );
}
