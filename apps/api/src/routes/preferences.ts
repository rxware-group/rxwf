import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { listLocales, normalizeLocaleCode } from '@rxwf/i18n-catalog';
import { listThemes } from '@rxwf/theme-catalog';
import type { createLitePreferencesRepository } from '@rxwf/providers-lite';

const EXEC_ENVIRONMENTS = new Set(['test', 'prod', 'dev', 'staging']);

export function registerPreferencesRoutes(
  app: FastifyInstance,
  _db: unknown,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  repo: ReturnType<typeof createLitePreferencesRepository>,
): void {

  app.get(
    '/api/users/me/preferences',
    { preHandler: authPreHandler },
    async (request) => {
      const prefs = await repo.get(request.auth!.userId);
      return prefs;
    },
  );

  app.patch(
    '/api/users/me/preferences',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        locale?: string;
        themePreference?: string;
        themeId?: string;
        executionEnvironment?: string;
      };
      if (body.locale !== undefined) {
        body.locale = normalizeLocaleCode(body.locale);
      }
      if (body.locale !== undefined && !listLocales().includes(body.locale)) {
        return reply.status(400).send({
          code: 'E1001',
          message: `Unknown locale: ${body.locale}`,
        });
      }
      if (body.themeId !== undefined && !listThemes().includes(body.themeId)) {
        return reply.status(400).send({
          code: 'E1001',
          message: `Unknown theme: ${body.themeId}`,
        });
      }
      if (
        body.executionEnvironment !== undefined &&
        !EXEC_ENVIRONMENTS.has(body.executionEnvironment)
      ) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'executionEnvironment must be dev, staging, or prod',
        });
      }
      const updated = await repo.patch(request.auth!.userId, body);
      return updated;
    },
  );
}
