import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from '@rxwf/identity';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { envDefaults } from '../config.js';

const MCP_NAME_PREFIX = 'mcp:';

export function registerMcpTokenRoutes(
  app: FastifyInstance,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  authService: AuthService,
  getRuntimeConfig?: () => Promise<RuntimeConfig>,
): void {
  app.get('/api/mcp-tokens', { preHandler: authPreHandler }, async (request) => {
    const userId = request.auth!.userId;
    const keys = await authService.listApiKeys(userId);
    return {
      tokens: keys
        .filter((k) => k.name.startsWith(MCP_NAME_PREFIX))
        .map((k) => ({
          id: k.id,
          name: k.name.slice(MCP_NAME_PREFIX.length),
          createdAt: k.createdAt,
        })),
    };
  });

  app.post('/api/mcp-tokens', { preHandler: authPreHandler }, async (request, reply) => {
    const userId = request.auth!.userId;
    const body = (request.body ?? {}) as { name?: string };
    const label = body.name?.trim() || 'default';
    const created = await authService.createApiKey(userId, `${MCP_NAME_PREFIX}${label}`);
    const runtime = getRuntimeConfig
      ? await getRuntimeConfig()
      : { publicUrl: envDefaults.publicUrl };
    const mcpJson = {
      mcpServers: {
        'rx-workflow': {
          url: `${runtime.publicUrl}/mcp`,
          headers: {
            'x-api-key': created.key,
          },
        },
      },
    };
    return reply.status(201).send({
      id: created.id,
      name: label,
      token: created.key,
      mcpJson,
    });
  });

  app.delete(
    '/api/mcp-tokens/:id',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const { id } = request.params as { id: string };
      const keys = await authService.listApiKeys(userId);
      const row = keys.find((k) => k.id === id && k.name.startsWith(MCP_NAME_PREFIX));
      if (!row) {
        return reply.status(404).send({ code: 'E1001', message: 'MCP token not found' });
      }
      await authService.revokeApiKey(userId, id);
      return { ok: true };
    },
  );
}
