import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { EnvRepositoryPort } from '@rxwf/env';
import {
  listPlatformEnvItems,
  PLATFORM_ENV_MASK,
  upsertPlatformEnvValues,
  type PlatformEnvDefaults,
} from '@rxwf/env';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { createLiteRunnerRepository } from '@rxwf/providers-lite';
import type { LiteDatabase } from '@rxwf/providers-lite';
import type { RunnerGatewayPort } from '@rxwf/providers-contracts';
import { envDefaults } from '../config.js';
import { runnerGateway as defaultGateway } from '../runners/gateway-instance.js';
import { listLocalDirectory, type BrowseFsResult } from '../env/browse-fs.js';

function buildDefaults(): PlatformEnvDefaults {
  return {
    publicUrl: envDefaults.publicUrl,
    smtpHost: envDefaults.smtpHost,
    smtpPort: envDefaults.smtpPort,
    smtpSecure: envDefaults.smtpSecure,
    smtpUser: envDefaults.smtpUser,
    smtpPassword: envDefaults.smtpPassword,
    smtpFrom: envDefaults.smtpFrom,
    webhookSecret: envDefaults.webhookSecret,
    brandProductName: envDefaults.brandProductName,
    brandLogoUrl: envDefaults.brandLogoUrl,
    langchainTracingV2: envDefaults.langchainTracingV2,
    langchainApiKey: envDefaults.langchainApiKey,
    langchainProject: envDefaults.langchainProject,
  };
}

async function browseOnRunnerAgent(
  gateway: RunnerGatewayPort,
  runnerId: string,
  path: string,
  dirsOnly: boolean,
): Promise<BrowseFsResult> {
  if (!gateway.isConnected(runnerId)) {
    throw Object.assign(new Error('Runner is offline; enter the path manually or wait until it is online.'), {
      statusCode: 503,
      code: 'E2011',
    });
  }
  const result = await gateway.invokeTool(
    runnerId,
    {
      invokeId: crypto.randomUUID(),
      executionId: 'env-browse',
      nodeRunId: 'env-browse',
      capability: 'admin:filesystem',
      method: 'list',
      args: { path, dirsOnly },
      timeoutMs: 15_000,
    },
    { timeoutMs: 15_000 },
  );
  if (result.status !== 'success' || !result.result || typeof result.result !== 'object') {
    throw Object.assign(
      new Error(
        result.errorMessage ??
          'Remote Runner browse failed; enter the path manually.',
      ),
      { statusCode: 502, code: result.errorCode ?? 'E1041' },
    );
  }
  const body = result.result as {
    path?: string;
    parent?: string | null;
    entries?: Array<{ name: string; path: string; kind: 'directory' | 'file' }>;
  };
  return {
    path: body.path ?? path,
    parent: body.parent ?? null,
    entries: body.entries ?? [],
    host: 'runner',
    runnerId,
  };
}

export function registerEnvRoutes(
  app: FastifyInstance,
  repo: EnvRepositoryPort,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  getRuntimeConfig?: () => Promise<RuntimeConfig>,
  options?: {
    db?: LiteDatabase;
    gateway?: RunnerGatewayPort;
  },
): void {
  const gateway = options?.gateway ?? defaultGateway;
  const db = options?.db;

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E5002', message: 'Admin required' });
    }
  };

  app.get(
    '/api/env',
    { preHandler: authPreHandler },
    async () => {
      const items = await listPlatformEnvItems(repo, {
        maskSensitive: true,
        defaults: buildDefaults(),
      });
      return { items };
    },
  );

  app.get(
    '/api/env/browse',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const q = request.query as {
        host?: string;
        runnerId?: string;
        path?: string;
        dirsOnly?: string;
      };
      const host = q.host === 'runner' ? 'runner' : q.host === 'controlPlane' ? 'controlPlane' : null;
      if (!host) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'host must be controlPlane or runner',
        });
      }
      const dirsOnly = q.dirsOnly !== '0' && q.dirsOnly !== 'false';
      const path = typeof q.path === 'string' ? q.path : '';

      try {
        if (host === 'controlPlane') {
          const result = await listLocalDirectory({ path, dirsOnly, host: 'controlPlane' });
          return result;
        }

        const runnerId = q.runnerId?.trim();
        if (!runnerId) {
          return reply.status(400).send({
            code: 'E1001',
            message: 'runnerId is required when host=runner',
          });
        }
        if (!db) {
          return reply.status(500).send({
            code: 'E1001',
            message: 'Runner browse is not configured',
          });
        }
        const runnerRepo = createLiteRunnerRepository(db);
        const runner = await runnerRepo.findById(runnerId);
        if (!runner) {
          return reply.status(404).send({
            code: 'E1001',
            message: `Runner not found: ${runnerId}`,
          });
        }

        if (runner.kind === 'embedded') {
          // Same machine as API; still labeled as runner (do not pretend controlPlane).
          return await listLocalDirectory({
            path,
            dirsOnly,
            host: 'runner',
            runnerId,
          });
        }

        return await browseOnRunnerAgent(gateway, runnerId, path, dirsOnly);
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode: number }).statusCode)
            : 400;
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : 'E1001';
        return reply.status(Number.isFinite(status) ? status : 400).send({
          code,
          message: err instanceof Error ? err.message : 'Browse failed',
        });
      }
    },
  );

  app.put(
    '/api/env',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body as {
        items?: Array<{ key?: string; value?: string }>;
      };
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        return reply.status(400).send({
          code: 'E1001',
          message: 'items array is required',
        });
      }
      const toWrite: Array<{ key: string; value: string }> = [];
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
        if (item.value === PLATFORM_ENV_MASK) {
          continue;
        }
        toWrite.push({ key, value: String(item.value) });
      }
      try {
        const items = await upsertPlatformEnvValues(repo, toWrite);
        if (getRuntimeConfig) {
          await getRuntimeConfig();
        }
        return { items };
      } catch (err) {
        return reply.status(400).send({
          code: 'E1001',
          message: err instanceof Error ? err.message : 'Invalid platform env',
        });
      }
    },
  );
}
