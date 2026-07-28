import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { VariablesRepositoryPort } from '@rxwf/variables';
import { groupGlobalVarRecords } from '@rxwf/variables';

export function registerVariablesRoutes(
  app: FastifyInstance,
  repo: VariablesRepositoryPort,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  app.get(
    '/api/variables',
    { preHandler: authPreHandler },
    async () => {
      const records = await repo.listAllGlobal();
      return { items: groupGlobalVarRecords(records) };
    },
  );

  app.put(
    '/api/variables',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = request.body as {
        items?: Array<{
          key?: string;
          value?: string;
          sensitive?: boolean;
          testEnabled?: boolean;
          prodEnabled?: boolean;
        }>;
      };
      if (!Array.isArray(body?.items)) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'items array is required',
        });
      }
      for (const item of body.items) {
        const key = item.key?.trim();
        if (!key) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'each item needs a non-empty key',
          });
        }
        if (item.value === undefined) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'each item needs value',
          });
        }
        const testEnabled = item.testEnabled ?? true;
        const prodEnabled = item.prodEnabled ?? true;
        if (!testEnabled && !prodEnabled) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'each item must enable test and/or prod',
          });
        }
        await repo.syncGlobalItem({
          key,
          value: String(item.value),
          sensitive: item.sensitive ?? false,
          testEnabled,
          prodEnabled,
        });
      }
      const records = await repo.listAllGlobal();
      return { items: groupGlobalVarRecords(records) };
    },
  );

  app.delete(
    '/api/variables/:id',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await repo.deleteById(id);
      return reply.status(204).send();
    },
  );
}
