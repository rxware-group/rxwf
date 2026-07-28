import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AwfError } from '@rxwf/shared';
import type { createModelCatalogService } from '@rxwf/model-catalog';
import type { createAuthPreHandler } from '../middleware/auth.js';

type ModelCatalogService = ReturnType<typeof createModelCatalogService>;

export function registerModelRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
  catalogService: ModelCatalogService,
): void {
  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E1003', message: 'Admin required' });
    }
  };

  app.get('/api/models/providers', { preHandler: authPreHandler }, async () => ({
    providers: await catalogService.listProviders(),
  }));

  app.post('/api/models/providers', { preHandler: adminOnly }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: string;
      kind?: 'ollama' | 'openai-compatible';
      baseUrl?: string;
      credentialId?: string | null;
      enabled?: boolean;
    };
    if (!body.name?.trim() || !body.kind || !body.baseUrl?.trim()) {
      return reply.status(400).send({ code: 'E1004', message: 'name, kind, and baseUrl required' });
    }
    const created = await catalogService.createProvider({
      id: crypto.randomUUID(),
      name: body.name.trim(),
      kind: body.kind,
      baseUrl: body.baseUrl.trim(),
      credentialId: body.credentialId ?? null,
      enabled: body.enabled ?? true,
    });
    return reply.status(201).send(created);
  });

  app.patch('/api/models/providers/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      name?: string;
      kind?: 'ollama' | 'openai-compatible';
      baseUrl?: string;
      credentialId?: string | null;
      enabled?: boolean;
    };
    const updated = await catalogService.updateProvider(id, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      kind: body.kind,
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined,
      credentialId: body.credentialId,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    });
    if (!updated) {
      return reply.status(404).send({ code: 'E3001', message: 'Model provider not found' });
    }
    return updated;
  });

  app.delete('/api/models/providers/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updated = await catalogService.disableProvider(id);
    if (!updated) {
      return reply.status(404).send({ code: 'E3001', message: 'Model provider not found' });
    }
    return updated;
  });

  app.get('/api/models', { preHandler: authPreHandler }, async (request) => {
    const query = request.query as { capability?: string };
    return { models: await catalogService.listModels({ capability: query.capability }) };
  });

  app.post('/api/models', { preHandler: adminOnly }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      providerId?: string;
      modelName?: string;
      capabilities?: string[];
      enabled?: boolean;
    };
    if (!body.providerId?.trim() || !body.modelName?.trim()) {
      return reply.status(400).send({ code: 'E1004', message: 'providerId and modelName required' });
    }
    const created = await catalogService.addModel({
      id: crypto.randomUUID(),
      providerId: body.providerId.trim(),
      modelName: body.modelName.trim(),
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : ['chat'],
      isDefaultChat: false,
      isDefaultWorkflow: false,
      enabled: body.enabled ?? true,
      source: 'manual',
    });
    return reply.status(201).send(created);
  });

  app.patch('/api/models/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      isDefaultChat?: boolean;
      isDefaultWorkflow?: boolean;
      enabled?: boolean;
    };
    const updated = await catalogService.updateModel(id, {
      isDefaultChat: typeof body.isDefaultChat === 'boolean' ? body.isDefaultChat : undefined,
      isDefaultWorkflow:
        typeof body.isDefaultWorkflow === 'boolean' ? body.isDefaultWorkflow : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    });
    if (!updated) {
      return reply.status(404).send({ code: 'E3001', message: 'Model not found' });
    }
    return updated;
  });

  app.post('/api/models/sync', { preHandler: adminOnly }, async (request, reply) => {
    const body = (request.body ?? {}) as { providerId?: string };
    if (!body.providerId?.trim()) {
      return reply.status(400).send({ code: 'E1004', message: 'providerId required' });
    }
    try {
      await catalogService.syncOllama(body.providerId.trim());
      return { ok: true };
    } catch (err) {
      if (err instanceof AwfError && err.code === 'E3001') {
        return reply.status(404).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post(
    '/api/models/providers/:id/health-check',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const updated = await catalogService.healthCheckProvider(id);
        return updated;
      } catch (err) {
        if (err instanceof AwfError && err.code === 'E3001') {
          return reply.status(404).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
