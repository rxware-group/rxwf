import type { FastifyInstance } from 'fastify';
import { setLocaleOverrides } from '@rxwf/i18n-catalog';
import { setThemeOverrides } from '@rxwf/theme-catalog';
import type { createAuthPreHandler } from '../middleware/auth.js';

export function registerAdminRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
): void {
  const adminOnly = async (
    request: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
  ) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E1003', message: 'Admin required' });
    }
  };

  app.put('/api/admin/i18n/:locale', { preHandler: adminOnly }, async (request) => {
    const { locale } = request.params as { locale: string };
    const body = (request.body ?? {}) as { messages?: Record<string, string> };
    setLocaleOverrides(locale, body.messages ?? {});
    return { ok: true, locale };
  });

  app.put('/api/admin/themes/:theme', { preHandler: adminOnly }, async (request) => {
    const { theme } = request.params as { theme: string };
    const body = (request.body ?? {}) as { tokens?: Record<string, string> };
    setThemeOverrides(theme, body.tokens ?? {});
    return { ok: true, theme };
  });
}
