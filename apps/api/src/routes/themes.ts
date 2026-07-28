import type { FastifyInstance } from 'fastify';
import { getThemeTokens, listThemes } from '@rxwf/theme-catalog';

export function registerThemeRoutes(app: FastifyInstance): void {
  app.get('/api/themes', async () => ({ themes: listThemes() }));

  app.get('/api/themes/:theme', async (request, reply) => {
    const { theme } = request.params as { theme: string };
    if (!listThemes().includes(theme)) {
      return reply.status(404).send({ code: 'E1001', message: `Theme not found: ${theme}` });
    }
    return { theme, tokens: getThemeTokens(theme) };
  });
}
