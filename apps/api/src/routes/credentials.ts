import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AwfError } from '@rxwf/shared';
import {
  applyAuth,
  createCredentialService,
  listCredentialTypeSummaries,
  parseCredentialKey,
} from '@rxwf/credential';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { createLiteCredentialRepository } from '@rxwf/providers-lite';
import { config } from '../config.js';

export function registerCredentialRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const repo = createLiteCredentialRepository(db);
  const service = createCredentialService({
    encryptionKey: parseCredentialKey(config.credentialKey),
    insert: (row) => repo.insert(row),
    list: () => repo.list(),
    findById: (id) => repo.findById(id),
    deleteById: (id) => repo.deleteById(id),
  });

  app.get(
    '/api/credentials',
    { preHandler: authPreHandler },
    async () => service.list(),
  );

  app.get(
    '/api/credentials/types',
    { preHandler: authPreHandler },
    async () => ({ types: listCredentialTypeSummaries() }),
  );

  app.post(
    '/api/credentials',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        type?: string;
        data?: Record<string, unknown>;
      };
      if (!body?.name || !body?.type || !body?.data) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'name, type and data are required',
        });
      }
      try {
        const created = await service.create({
          name: body.name,
          type: body.type,
          data: body.data,
        });
        return reply.status(201).send(created);
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.delete(
    '/api/credentials/:credentialId',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { credentialId } = request.params as { credentialId: string };
      try {
        await service.remove(credentialId);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(404).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/credentials/:credentialId/test',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { credentialId } = request.params as { credentialId: string };
      try {
        return await service.test(credentialId);
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(404).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/credentials/:credentialId/apply-auth',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { credentialId } = request.params as { credentialId: string };
      try {
        const resolved = await service.resolveForAuth(credentialId);
        const headers = applyAuth(resolved.type, resolved.data);
        const hasAuthHeader = Object.entries(headers).some(
          ([name, value]) => name.trim() !== '' && value.trim() !== '',
        );
        if (!hasAuthHeader) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'apply-auth produced no auth headers',
          });
        }
        return { headers };
      } catch (err) {
        if (err instanceof AwfError) {
          const status = err.message.includes('not found') ? 404 : 400;
          return reply.status(status).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
