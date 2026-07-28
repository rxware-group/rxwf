import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { createPluginHost } from '@rxwf/plugin-host';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

type PluginHost = ReturnType<typeof createPluginHost>;

export function registerPluginRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
  pluginHost: PluginHost,
): void {
  app.get('/api/plugins', { preHandler: authPreHandler }, async () => ({
    plugins: pluginHost.list(),
  }));

  app.post('/api/plugins/register', { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body ?? {}) as { manifest?: string; signature?: string };
    if (!body.manifest || !body.signature) {
      return reply.status(400).send({ code: 'E1004', message: 'manifest and signature required' });
    }
    try {
      const registered = pluginHost.registerFromManifest(body.manifest, body.signature);
      return { ok: true, id: registered.id, type: registered.type };
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post(
    '/api/plugins/:id/enable',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        pluginHost.enable(id);
        return { ok: true, enabled: true };
      } catch (err) {
        if (err instanceof AwfError && err.code === 'E1001') {
          return reply.status(404).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/plugins/:id/disable',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        pluginHost.disable(id);
        return { ok: true, enabled: false };
      } catch (err) {
        if (err instanceof AwfError && err.code === 'E1001') {
          return reply.status(404).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
