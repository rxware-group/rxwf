import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { inArray } from 'drizzle-orm';
import { createUserService } from '@rxwf/identity';
import { AwfError } from '@rxwf/shared';
import type { KnowledgeService } from '@rxwf/knowledge';
import { isKnowledgePlatformConfigured, type KnowledgePlatformConfig } from '@rxwf/knowledge';
import { createModelCatalogService } from '@rxwf/model-catalog';
import type { KnowledgeBaseRecord } from '@rxwf/providers-contracts';
import {
  createKnowledgeBaseCollaboratorRepository,
  createLiteModelCatalogRepository,
  liteSchema,
  type KnowledgeBaseRole,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import type { createAuthPreHandler } from '../middleware/auth.js';

type KnowledgeAccessRole = KnowledgeBaseRole | 'admin';

function canWrite(role: string): boolean {
  return role === 'admin' || role === 'member';
}

function canEditKnowledge(accessRole: KnowledgeAccessRole | null): boolean {
  return (
    accessRole === 'admin' ||
    accessRole === 'owner' ||
    accessRole === 'editor' ||
    accessRole == null
  );
}

function canViewKnowledge(accessRole: KnowledgeAccessRole | null, globalRole: string): boolean {
  return globalRole === 'admin' || accessRole != null;
}

function canShareKnowledge(accessRole: KnowledgeAccessRole | null): boolean {
  return accessRole === 'admin' || accessRole === 'owner' || accessRole === 'editor';
}

function serializeKnowledgeBase(
  kb: KnowledgeBaseRecord,
  extra?: {
    accessRole?: KnowledgeAccessRole | null;
    ownerEmail?: string | null;
    ownerNickname?: string | null;
  },
) {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description,
    ownerUserId: kb.ownerUserId,
    embeddingModel: kb.embeddingModel,
    chunkSize: kb.chunkSize,
    chunkOverlap: kb.chunkOverlap,
    topK: kb.topK,
    similarityThreshold: kb.similarityThreshold,
    hybridSearchEnabled: kb.hybridSearchEnabled,
    createdAt: kb.createdAt.toISOString(),
    updatedAt: kb.updatedAt.toISOString(),
    accessRole: extra?.accessRole ?? null,
    ownerEmail: extra?.ownerEmail ?? null,
    ownerNickname: extra?.ownerNickname ?? null,
  };
}

export function registerKnowledgeBaseRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
  knowledge: KnowledgeService,
  liteDb: LiteDatabase,
  getKnowledgePlatformConfig: () => Promise<KnowledgePlatformConfig>,
): void {
  const collaboratorRepo = createKnowledgeBaseCollaboratorRepository(liteDb);
  const users = createUserService(liteDb);
  const catalogService = createModelCatalogService({
    repo: createLiteModelCatalogRepository(liteDb),
  });

  async function assertKnowledgePlatformConfigured(
    reply: FastifyReply,
  ): Promise<boolean> {
    const platform = await getKnowledgePlatformConfig();
    const ok = await isKnowledgePlatformConfigured(platform, {
      resolveModelRef: async (modelId) => {
        try {
          await catalogService.resolveModelRef(modelId);
          return true;
        } catch {
          return false;
        }
      },
    });
    if (!ok) {
      await reply.status(400).send({
        code: 'E1004',
        message: 'Knowledge platform is not configured. Configure it in Settings → Knowledge.',
      });
      return false;
    }
    return true;
  }

  async function reindexKnowledgeBase(knowledgeBaseId: string): Promise<number> {
    const docs = await knowledge.listDocuments(knowledgeBaseId);
    let queued = 0;
    for (const doc of docs) {
      if (doc.status === 'indexed' || doc.status === 'failed') {
        await knowledge.reindexDocument(doc.id);
        queued++;
      }
    }
    return queued;
  }

  async function resolveAccessRole(
    kb: KnowledgeBaseRecord,
    userId: string,
    globalRole: string,
  ): Promise<KnowledgeAccessRole | null> {
    if (globalRole === 'admin') return 'admin';
    const role = await collaboratorRepo.getEffectiveRole(kb.id, userId, kb.ownerUserId);
    return role;
  }

  async function enrichKnowledgeBases(
    bases: KnowledgeBaseRecord[],
    userId: string,
    globalRole: string,
  ) {
    const ownerIds = [...new Set(bases.map((kb) => kb.ownerUserId))];
    const userRows =
      ownerIds.length > 0
        ? await liteDb
            .select({
              id: liteSchema.users.id,
              email: liteSchema.users.email,
              nickname: liteSchema.users.nickname,
            })
            .from(liteSchema.users)
            .where(inArray(liteSchema.users.id, ownerIds))
        : [];
    const usersById = new Map(userRows.map((row) => [row.id, row]));
    return Promise.all(
      bases.map(async (kb) => {
        const owner = usersById.get(kb.ownerUserId);
        return serializeKnowledgeBase(kb, {
          accessRole: await resolveAccessRole(kb, userId, globalRole),
          ownerEmail: owner?.email ?? null,
          ownerNickname: owner?.nickname?.trim() ? owner.nickname : null,
        });
      }),
    );
  }

  async function withKnowledgeAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    knowledgeBaseId: string,
    mode: 'view' | 'share',
    handler: (kb: KnowledgeBaseRecord, accessRole: KnowledgeAccessRole | null) => Promise<unknown>,
  ) {
    const kb = await knowledge.getBase(knowledgeBaseId);
    if (!kb) {
      return reply.status(404).send({ code: 'E1001', message: 'Knowledge base not found' });
    }
    const accessRole = await resolveAccessRole(kb, request.auth!.userId, request.auth!.role);
    const allowed =
      mode === 'share'
        ? canShareKnowledge(accessRole)
        : canViewKnowledge(accessRole, request.auth!.role);
    if (!allowed) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    return handler(kb, accessRole);
  }

  app.get('/api/knowledge-bases', { preHandler: authPreHandler }, async (request, reply) => {
    const auth = request.auth!;
    const scopeParam = (request.query as { scope?: string }).scope;
    let bases: KnowledgeBaseRecord[] = [];

    if (scopeParam === 'all') {
      if (auth.role !== 'admin') {
        return reply.status(403).send({ code: 'E1003', message: 'Admin required' });
      }
      bases = await knowledge.listBases();
    } else if (scopeParam === 'mine') {
      bases = await knowledge.listBases({ ownerUserId: auth.userId });
    } else if (scopeParam === 'shared') {
      const sharedIds = await collaboratorRepo.listSharedKnowledgeBaseIds(auth.userId);
      const owned = await knowledge.listBases({ ownerUserId: auth.userId });
      const ownedSet = new Set(owned.map((kb) => kb.id));
      const ids = sharedIds.filter((id) => !ownedSet.has(id));
      bases = ids.length ? await knowledge.listBases({ ids }) : [];
    } else if (scopeParam !== undefined) {
      return reply.status(400).send({ code: 'E1001', message: 'Invalid scope' });
    } else if (auth.role === 'admin') {
      bases = await knowledge.listBases();
    } else {
      const mine = await knowledge.listBases({ ownerUserId: auth.userId });
      const sharedIds = await collaboratorRepo.listSharedKnowledgeBaseIds(auth.userId);
      const ownedSet = new Set(mine.map((kb) => kb.id));
      const extraIds = sharedIds.filter((id) => !ownedSet.has(id));
      const shared = extraIds.length ? await knowledge.listBases({ ids: extraIds }) : [];
      bases = [...mine, ...shared];
    }

    const items = await enrichKnowledgeBases(bases, auth.userId, auth.role);
    return { items };
  });

  app.post('/api/knowledge-bases', { preHandler: authPreHandler }, async (request, reply) => {
    if (!canWrite(request.auth!.role)) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    if (!(await assertKnowledgePlatformConfigured(reply))) return;
    const body = (request.body ?? {}) as {
      name?: string;
      description?: string;
      embeddingModel?: string;
      chunkSize?: number;
      chunkOverlap?: number;
      topK?: number;
      similarityThreshold?: number;
      hybridSearchEnabled?: boolean;
    };
    if (!body.name?.trim()) {
      return reply.status(400).send({ code: 'E1004', message: 'name required' });
    }
    const created = await knowledge.createBase({
      name: body.name,
      description: body.description,
      ownerUserId: request.auth!.userId,
      embeddingModel: body.embeddingModel,
      chunkSize: body.chunkSize,
      chunkOverlap: body.chunkOverlap,
      topK: body.topK,
      similarityThreshold: body.similarityThreshold,
      hybridSearchEnabled: body.hybridSearchEnabled,
    });
    const [enriched] = await enrichKnowledgeBases(
      [created],
      request.auth!.userId,
      request.auth!.role,
    );
    return reply.status(201).send(enriched);
  });

  app.get('/api/knowledge-bases/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return withKnowledgeAccess(request, reply, id, 'view', async (kb) => {
      const [enriched] = await enrichKnowledgeBases(
        [kb],
        request.auth!.userId,
        request.auth!.role,
      );
      return enriched;
    });
  });

  app.patch('/api/knowledge-bases/:id', { preHandler: authPreHandler }, async (request, reply) => {
    if (!canWrite(request.auth!.role)) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const existing = await knowledge.getBase(id);
    if (!existing) {
      return reply.status(404).send({ code: 'E1001', message: 'Knowledge base not found' });
    }
    const accessRole = await resolveAccessRole(
      existing,
      request.auth!.userId,
      request.auth!.role,
    );
    if (!canEditKnowledge(accessRole)) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const updated = await knowledge.updateBase(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      embeddingModel:
        typeof body.embeddingModel === 'string' ? body.embeddingModel : undefined,
      chunkSize: typeof body.chunkSize === 'number' ? body.chunkSize : undefined,
      chunkOverlap: typeof body.chunkOverlap === 'number' ? body.chunkOverlap : undefined,
      topK: typeof body.topK === 'number' ? body.topK : undefined,
      similarityThreshold:
        typeof body.similarityThreshold === 'number' ? body.similarityThreshold : undefined,
      hybridSearchEnabled:
        typeof body.hybridSearchEnabled === 'boolean' ? body.hybridSearchEnabled : undefined,
    });
    if (!updated) {
      return reply.status(404).send({ code: 'E1001', message: 'Knowledge base not found' });
    }
    return updated;
  });

  app.delete('/api/knowledge-bases/:id', { preHandler: authPreHandler }, async (request, reply) => {
    if (!canWrite(request.auth!.role)) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const existing = await knowledge.getBase(id);
    if (!existing) {
      return reply.status(404).send({ code: 'E1001', message: 'Knowledge base not found' });
    }
    const accessRole = await resolveAccessRole(
      existing,
      request.auth!.userId,
      request.auth!.role,
    );
    if (accessRole !== 'admin' && accessRole !== 'owner') {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    const ok = await knowledge.deleteBase(id);
    if (!ok) {
      return reply.status(404).send({ code: 'E1001', message: 'Knowledge base not found' });
    }
    return reply.status(204).send();
  });

  app.get(
    '/api/knowledge-bases/:id/documents',
    { preHandler: authPreHandler },
    async (request) => {
      const { id } = request.params as { id: string };
      return { items: await knowledge.listDocuments(id) };
    },
  );

  app.post(
    '/api/knowledge-bases/:id/documents',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      if (!(await assertKnowledgePlatformConfigured(reply))) return;
      const { id } = request.params as { id: string };

      if (request.isMultipart()) {
        const part = await request.file();
        if (!part) {
          return reply.status(400).send({ code: 'E1004', message: 'file required' });
        }
        const buffer = await part.toBuffer();
        const doc = await knowledge.uploadDocument({
          knowledgeBaseId: id,
          fileName: part.filename,
          mimeType: part.mimetype || 'application/octet-stream',
          buffer,
        });
        return reply.status(201).send(doc);
      }

      const body = (request.body ?? {}) as {
        fileName?: string;
        mimeType?: string;
        contentBase64?: string;
      };
      if (!body.fileName || !body.contentBase64) {
        return reply
          .status(400)
          .send({ code: 'E1004', message: 'fileName and contentBase64 required' });
      }
      const buffer = Buffer.from(body.contentBase64, 'base64');
      const doc = await knowledge.uploadDocument({
        knowledgeBaseId: id,
        fileName: body.fileName,
        mimeType: body.mimeType ?? 'application/octet-stream',
        buffer,
      });
      return reply.status(201).send(doc);
    },
  );

  app.delete(
    '/api/knowledge-bases/:id/documents/:docId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      const { docId } = request.params as { id: string; docId: string };
      const ok = await knowledge.deleteDocument(docId);
      if (!ok) {
        return reply.status(404).send({ code: 'E1001', message: 'Document not found' });
      }
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/knowledge-bases/:id/documents/:docId/reindex',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      const { docId } = request.params as { id: string; docId: string };
      const doc = await knowledge.reindexDocument(docId);
      return reply.status(202).send(doc);
    },
  );

  app.get(
    '/api/knowledge-bases/:id/chunks',
    { preHandler: authPreHandler },
    async (request) => {
      const { id } = request.params as { id: string };
      const q = request.query as { documentId?: string };
      return {
        items: await knowledge.listChunks(id, q.documentId),
      };
    },
  );

  app.post('/api/knowledge-bases/:id/query', { preHandler: authPreHandler }, async (request, reply) => {
    if (!(await assertKnowledgePlatformConfigured(reply))) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      query?: string;
      topK?: number;
      threshold?: number;
    };
    const queryText = String(body.query ?? '').trim();
    if (!queryText) {
      return reply.status(400).send({ code: 'E1004', message: 'query required' });
    }
    try {
      const hits = await knowledge.query(id, queryText, {
        topK: body.topK,
        threshold: body.threshold,
      });
      return { hits };
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(err.code === 'E3003' ? 404 : 400).send({
          code: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.get(
    '/api/knowledge-bases/:id/sync-sources',
    { preHandler: authPreHandler },
    async (request) => {
      const { id } = request.params as { id: string };
      return { items: await knowledge.listSyncSources(id) };
    },
  );

  app.post(
    '/api/knowledge-bases/:id/sync-sources',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { kind?: string; path?: string; enabled?: boolean };
      if (body.kind !== 'local_dir' || !body.path?.trim()) {
        return reply
          .status(400)
          .send({ code: 'E1004', message: 'kind=local_dir and path required' });
      }
      const created = await knowledge.createSyncSource({
        knowledgeBaseId: id,
        kind: 'local_dir',
        path: body.path.trim(),
        enabled: body.enabled,
      });
      return reply.status(201).send(created);
    },
  );

  app.delete(
    '/api/knowledge-bases/:id/sync-sources/:sourceId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      const { sourceId } = request.params as { id: string; sourceId: string };
      const ok = await knowledge.deleteSyncSource(sourceId);
      if (!ok) {
        return reply.status(404).send({ code: 'E1001', message: 'Sync source not found' });
      }
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/knowledge-bases/:id/sync-sources/:sourceId/trigger',
    { preHandler: authPreHandler },
    async (request, reply) => {
      if (!canWrite(request.auth!.role)) {
        return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
      }
      const { sourceId } = request.params as { id: string; sourceId: string };
      await knowledge.triggerSyncSource(sourceId);
      return reply.status(202).send({ queued: true });
    },
  );

  app.post('/api/knowledge-bases/reindex-all', { preHandler: authPreHandler }, async (request, reply) => {
    if (request.auth!.role !== 'admin') {
      return reply.status(403).send({ code: 'E1003', message: 'Admin required' });
    }
    if (!(await assertKnowledgePlatformConfigured(reply))) return;
    const bases = await knowledge.listBases();
    let queued = 0;
    for (const kb of bases) {
      queued += await reindexKnowledgeBase(kb.id);
    }
    return { queued };
  });

  app.post(
    '/api/knowledge-bases/:id/reindex-all',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return withKnowledgeAccess(request, reply, id, 'view', async (kb, accessRole) => {
        if (!canEditKnowledge(accessRole) && request.auth!.role !== 'admin') {
          return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
        }
        if (!(await assertKnowledgePlatformConfigured(reply))) return;
        const queued = await reindexKnowledgeBase(kb.id);
        return { queued };
      });
    },
  );

  app.get(
    '/api/knowledge-bases/:id/collaborators',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return withKnowledgeAccess(request, reply, id, 'view', async (kb) => {
        const collaborators = await collaboratorRepo.list(id);
        const owner = await users.findById(kb.ownerUserId);
        return {
          ownerUserId: kb.ownerUserId,
          ownerEmail: owner?.email ?? null,
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
    '/api/knowledge-bases/:id/collaborators',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return withKnowledgeAccess(request, reply, id, 'share', async (kb) => {
        const body = (request.body ?? {}) as {
          collaborators?: Array<{ userId?: string; role?: KnowledgeBaseRole }>;
        };
        if (!Array.isArray(body.collaborators)) {
          return reply.status(400).send({ code: 'E1001', message: 'collaborators array required' });
        }

        const desired = new Map<string, KnowledgeBaseRole>();
        for (const entry of body.collaborators) {
          const userId = String(entry.userId ?? '').trim();
          const role = entry.role;
          if (!userId || !role || !['owner', 'editor', 'viewer'].includes(role)) {
            return reply.status(400).send({ code: 'E1001', message: 'Invalid collaborator entry' });
          }
          if (userId === kb.ownerUserId) continue;
          desired.set(userId, role);
        }

        const current = await collaboratorRepo.list(id);
        for (const [userId, role] of desired) {
          await collaboratorRepo.upsert(id, userId, role);
        }
        for (const row of current) {
          if (row.userId === kb.ownerUserId) continue;
          if (!desired.has(row.userId)) {
            await collaboratorRepo.remove(id, row.userId);
          }
        }

        const collaborators = await collaboratorRepo.list(id);
        const owner = await users.findById(kb.ownerUserId);
        return {
          ownerUserId: kb.ownerUserId,
          ownerEmail: owner?.email ?? null,
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
    '/api/knowledge-bases/:id/collaborators/candidates',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return withKnowledgeAccess(request, reply, id, 'share', async () => {
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
