import type { FastifyInstance } from 'fastify';
import { getLocaleBundle, listLocales, normalizeLocaleCode } from '@rxwf/i18n-catalog';

export function registerI18nRoutes(app: FastifyInstance): void {
  app.get('/api/i18n', async () => ({ locales: listLocales() }));

  app.get('/api/i18n/:locale', async (request, reply) => {
    const { locale: raw } = request.params as { locale: string };
    const locale = normalizeLocaleCode(raw);
    if (!listLocales().includes(locale)) {
      return reply.status(404).send({ code: 'E1001', message: `Locale not found: ${raw}` });
    }
    return { locale, messages: getLocaleBundle(locale) };
  });
}
