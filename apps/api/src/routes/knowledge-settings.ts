import {
  embeddingConfigRequiresReindex,
  isKnowledgePlatformConfigured,
  parseKnowledgePlatformConfig,
  resolveEmbeddingProvider,
  type KnowledgePlatformConfig,
} from '@rxwf/knowledge';
import { createModelCatalogService } from '@rxwf/model-catalog';
import { createCredentialService, parseCredentialKey } from '@rxwf/credential';
import { createLiteCredentialRepository, createLiteModelCatalogRepository } from '@rxwf/providers-lite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../app-context.js';
import { saveKnowledgePlatformConfig } from '../knowledge/load-platform-config.js';
import { createCredentialResolver } from '../credentials/create-credential-resolver.js';
import { config } from '../config.js';

function normalizeKnowledgeConfig(
  body: Record<string, unknown>,
  current: KnowledgePlatformConfig,
): KnowledgePlatformConfig {
  const embedding = (body.embedding ?? {}) as Partial<KnowledgePlatformConfig['embedding']>;
  const rag = (body.rag ?? {}) as Partial<KnowledgePlatformConfig['rag']>;
  const defaults = (body.defaults ?? {}) as Partial<KnowledgePlatformConfig['defaults']>;
  return parseKnowledgePlatformConfig(
    JSON.stringify({
      configured: body.configured === true || body.configured === 'true' || current.configured,
      embedding: {
        ...current.embedding,
        ...embedding,
      },
      rag: {
        ...current.rag,
        ...rag,
      },
      defaults: {
        ...current.defaults,
        ...defaults,
      },
    }),
  );
}

function toReadOnlySnapshot(
  platformConfig: KnowledgePlatformConfig,
  status: { profile: string; jobQueue: 'lite' | 'bullmq' },
) {
  return {
    configured: platformConfig.configured,
    embedding: {
      provider: platformConfig.embedding.provider,
      baseUrl: platformConfig.embedding.baseUrl,
      defaultModel: platformConfig.embedding.defaultModel,
      dimensions: platformConfig.embedding.dimensions,
    },
    rag: platformConfig.rag,
    defaults: platformConfig.defaults,
    status,
  };
}

export function registerKnowledgeSettingsRoutes(
  app: FastifyInstance,
  ctx: Pick<
    AppContext,
    'settingsService' | 'liteDb' | 'getKnowledgePlatformConfig' | 'profile' | 'knowledge'
  >,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const catalogService = createModelCatalogService({
    repo: createLiteModelCatalogRepository(ctx.liteDb),
  });

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E5002', message: 'Admin required' });
    }
  };

  const status = () => ({
    profile: ctx.profile,
    jobQueue:
      ctx.profile === 'standard' && Boolean(config.redisUrl)
        ? ('bullmq' as const)
        : ('lite' as const),
  });

  app.get('/api/settings/knowledge', { preHandler: authPreHandler }, async (request) => {
    const current = await ctx.getKnowledgePlatformConfig();
    const snap = toReadOnlySnapshot(current, status());
    if (request.auth?.role === 'admin') {
      return {
        ...snap,
        embedding: {
          ...snap.embedding,
          credentialId: current.embedding.credentialId ?? null,
        },
        editable: true,
      };
    }
    return { ...snap, editable: false };
  });

  app.put('/api/settings/knowledge', { preHandler: requireAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const previous = await ctx.getKnowledgePlatformConfig();
    const next = normalizeKnowledgeConfig(body, previous);

    const modelOk = await isKnowledgePlatformConfigured(next, {
      resolveModelRef: async (modelId) => {
        try {
          await catalogService.resolveModelRef(modelId);
          return true;
        } catch {
          return false;
        }
      },
    });
    if (!modelOk) {
      return reply.status(400).send({
        code: 'E1004',
        message: 'Knowledge platform config is incomplete or invalid',
      });
    }

    const persisted: KnowledgePlatformConfig = {
      ...next,
      configured: true,
    };
    await saveKnowledgePlatformConfig(ctx.settingsService, persisted);

    return {
      ok: true,
      embeddingChanged: embeddingConfigRequiresReindex(previous, persisted),
      ...toReadOnlySnapshot(persisted, status()),
      embedding: {
        ...persisted.embedding,
        credentialId: persisted.embedding.credentialId ?? null,
      },
    };
  });

  app.post(
    '/api/settings/knowledge/test-embedding',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const saved = await ctx.getKnowledgePlatformConfig();
      const draft = normalizeKnowledgeConfig(
        Object.keys(body).length > 0 ? { embedding: body.embedding, rag: body.rag, defaults: body.defaults } : {},
        saved,
      );

      const credentialService = createCredentialService({
        encryptionKey: parseCredentialKey(config.credentialKey),
        insert: (row) => createLiteCredentialRepository(ctx.liteDb).insert(row),
        list: () => createLiteCredentialRepository(ctx.liteDb).list(),
        findById: (id) => createLiteCredentialRepository(ctx.liteDb).findById(id),
        deleteById: (id) => createLiteCredentialRepository(ctx.liteDb).deleteById(id),
      });
      const credentialResolver = createCredentialResolver(credentialService);

      const started = Date.now();
      try {
        const provider = await resolveEmbeddingProvider(
          draft,
          draft.embedding.defaultModel,
          { credentialResolver },
        );
        const vector = await provider.embed('rx-workflow knowledge embedding test');
        return {
          ok: true,
          dimensions: vector.length,
          latencyMs: Date.now() - started,
        };
      } catch (err) {
        return reply.status(400).send({
          code: 'E3002',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
