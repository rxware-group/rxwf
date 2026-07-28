import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createWorkflowService } from '@rxwf/workflow';
import { listTemplateCatalog, loadTemplateDefinition } from '../templates/catalog.js';

export function registerTemplateRoutes(
  app: FastifyInstance,
  workflowService: ReturnType<typeof createWorkflowService>,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {

  app.get('/api/templates', { preHandler: authPreHandler }, async () => ({
    templates: listTemplateCatalog(),
  }));

  app.post(
    '/api/templates/:templateId/clone',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const { templateId } = request.params as { templateId: string };
      try {
        const definition = loadTemplateDefinition(templateId);
        const created = await workflowService.create({
          name: definition.name,
          definition,
        });
        return reply.status(201).send({ id: created.id });
      } catch {
        return reply.status(404).send({
          code: 'E1001',
          message: `Template not found: ${templateId}`,
        });
      }
    },
  );
}
