import { SETTING_KEYS } from '@rxwf/system-settings';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createWebSearchPort,
  parseWebSearchSettings,
  serializeWebSearchSettings,
  type SystemWebSearchSettings,
  type WebSearchProviderId,
} from '@rxwf/web-search';
import type { AppContext } from '../app-context.js';
import { createCredentialResolver } from '../credentials/create-credential-resolver.js';
import { createLiteCredentialRepository } from '@rxwf/providers-lite';
import { createCredentialService, parseCredentialKey } from '@rxwf/credential';
import { config } from '../config.js';

const PROVIDER_IDS: WebSearchProviderId[] = ['tavily', 'brave', 'bing', 'custom'];

function normalizeSettings(body: Record<string, unknown>): SystemWebSearchSettings {
  const current = parseWebSearchSettings(undefined);
  const provider = String(body.defaultProvider ?? current.defaultProvider);
  return {
    enabled: body.enabled === true || body.enabled === 'true',
    defaultProvider: PROVIDER_IDS.includes(provider as WebSearchProviderId)
      ? (provider as WebSearchProviderId)
      : current.defaultProvider,
    defaultCredentialId:
      body.defaultCredentialId === undefined
        ? current.defaultCredentialId
        : String(body.defaultCredentialId ?? '').trim() || undefined,
    maxQueriesPerExecution:
      body.maxQueriesPerExecution === undefined
        ? current.maxQueriesPerExecution
        : Math.max(1, Math.floor(Number(body.maxQueriesPerExecution) || 10)),
    timeoutMs:
      body.timeoutMs === undefined
        ? current.timeoutMs
        : Math.max(1000, Math.floor(Number(body.timeoutMs) || 30_000)),
    maxResults:
      body.maxResults === undefined
        ? current.maxResults
        : Math.max(1, Math.floor(Number(body.maxResults) || 10)),
    allowedDomains: Array.isArray(body.allowedDomains)
      ? body.allowedDomains.map(String).filter(Boolean)
      : current.allowedDomains,
    customBaseUrl:
      body.customBaseUrl === undefined
        ? current.customBaseUrl
        : String(body.customBaseUrl ?? '').trim() || undefined,
  };
}

async function resolveTestPort(
  ctx: Pick<AppContext, 'settingsService' | 'liteDb'>,
  settings: SystemWebSearchSettings,
): Promise<ReturnType<typeof createWebSearchPort>> {
  if (!settings.defaultCredentialId) {
    throw new Error('defaultCredentialId is required');
  }
  const credentialService = createCredentialService({
    encryptionKey: parseCredentialKey(config.credentialKey),
    insert: (row) => createLiteCredentialRepository(ctx.liteDb).insert(row),
    list: () => createLiteCredentialRepository(ctx.liteDb).list(),
    findById: (id) => createLiteCredentialRepository(ctx.liteDb).findById(id),
    deleteById: (id) => createLiteCredentialRepository(ctx.liteDb).deleteById(id),
  });
  const creds = await createCredentialResolver(credentialService)(
    settings.defaultCredentialId,
  );
  const apiKey = creds.apiKey?.trim();
  if (settings.defaultProvider !== 'custom' && !apiKey) {
    throw new Error('Credential must include apiKey');
  }
  const baseUrl =
    settings.defaultProvider === 'custom'
      ? settings.customBaseUrl?.trim() || creds.baseUrl?.trim()
      : undefined;
  if (settings.defaultProvider === 'custom' && !baseUrl) {
    throw new Error('customBaseUrl is required for custom provider');
  }
  return createWebSearchPort(settings.defaultProvider, { apiKey, baseUrl });
}

export function registerWebSearchSettingsRoutes(
  app: FastifyInstance,
  ctx: Pick<AppContext, 'settingsService' | 'liteDb'>,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E5002', message: 'Admin required' });
    }
  };

  app.get('/api/settings/web-search', { preHandler: requireAdmin }, async () => {
    const raw = await ctx.settingsService.get(SETTING_KEYS.webSearchConfig);
    return parseWebSearchSettings(raw);
  });

  app.put('/api/settings/web-search', { preHandler: requireAdmin }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const settings = normalizeSettings(body);
    await ctx.settingsService.set(
      SETTING_KEYS.webSearchConfig,
      serializeWebSearchSettings(settings),
    );
    return { ok: true, ...settings };
  });

  app.post(
    '/api/settings/web-search/test',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const raw = await ctx.settingsService.get(SETTING_KEYS.webSearchConfig);
      const saved = parseWebSearchSettings(raw);
      const settings =
        Object.keys(body).length > 0 ? normalizeSettings({ ...saved, ...body }) : saved;

      if (!settings.enabled) {
        return reply.status(400).send({ code: 'E1071', message: 'Web search is disabled' });
      }

      const started = Date.now();
      try {
        const port = await resolveTestPort(ctx, settings);
        const result = await port.search(
          { query: 'rx-workflow ping' },
          { maxResults: settings.maxResults, timeoutMs: settings.timeoutMs },
        );
        return {
          ok: true,
          latencyMs: Date.now() - started,
          preview: result.summary.slice(0, 500),
        };
      } catch (err) {
        return reply.status(400).send({
          code: 'E1074',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
