import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import type { BuildAppOptions } from './build-options.js';
import { config } from './config.js';
import { createAuthPreHandler } from './middleware/auth.js';
import { registerWorkflowRoutes } from './routes/workflows.js';
import { registerExecutionRoutes } from './routes/executions.js';
import { registerCredentialRoutes } from './routes/credentials.js';
import { registerEnvRoutes } from './routes/env.js';
import { registerVariablesRoutes } from './routes/variables.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerRunnerRoutes } from './routes/runners.js';
import { runnerGateway } from './runners/gateway-instance.js';
import { startRunnerOfflineSweeper } from './runners/sweeper.js';
import { startHitlTimeoutSweeperForRuntime } from './execution/start-hitl-sweeper.js';
import { registerRunnerWebSocket } from './runners/ws-handler.js';
import { registerI18nRoutes } from './routes/i18n.js';
import { registerThemeRoutes } from './routes/themes.js';
import { registerMcpRoutes } from './routes/mcp.js';
import { registerWebhookListenRoutes } from './routes/webhook-listen.js';
import { registerWebhookRoutes } from './routes/webhook.js';
import { startApiScheduler } from './scheduler/create-scheduler.js';
import { startJobLoop } from './execution/job-loop.js';
import { bootstrapPlus } from './bootstrap-plus.js';
import { registerSetupRoutes } from './routes/setup.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminUserRoutes } from './routes/admin-users.js';
import { registerPreferencesRoutes } from './routes/preferences.js';
import { registerUserProfileRoutes } from './routes/user-profile.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { registerMcpTokenRoutes } from './routes/mcp-tokens.js';
import { registerSettingsRoutes } from './routes/settings.js';
import {
  createBullMQQueueProvider,
  createStandardHealthChecker,
} from '@rxwf/providers-standard';
import { createAppContext, type AppContext } from './app-context.js';
import { createApiTriggerIngress } from './trigger/create-trigger-ingress.js';
import {
  createLiteCredentialRepository,
  createWorkflowCollaboratorRepository,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import {
  createCredentialService,
  parseCredentialKey,
} from '@rxwf/credential';
import { createCredentialResolver } from './credentials/create-credential-resolver.js';
import { createMailer } from '@rxwf/system-settings';
import { createWorkflowAccessService } from '@rxwf/identity';
import { ensurePlatformEnv } from './env/ensure-platform-env.js';
import { registerInternalCrewToolRoutes } from './routes/internal-crew-tool.js';
import { registerInternalCrewCredentialRoutes } from './routes/internal-crew-credential.js';
import { registerSkillRoutes } from './routes/skills.js';
import { registerRxwfWorkspaceRoutes } from './routes/rxwf-workspace.js';
import { registerWebSearchSettingsRoutes } from './routes/web-search-settings.js';
import { registerKnowledgeSettingsRoutes } from './routes/knowledge-settings.js';
import { registerRulesRoutes } from './routes/rules.js';
import { registerInstructionContextRoutes } from './routes/instruction-contexts.js';
import { registerWorkflowsCatalogRoutes } from './routes/workflows-catalog.js';
import { registerAgentMemoryRoutes } from './routes/agent-memory.js';

let ready = false;
let stopScheduler: (() => void) | undefined;
let stopJobLoop: (() => void) | undefined;
let stopRunnerSweeper: (() => void) | undefined;
let stopHitlSweeper: (() => void) | undefined;
let appContext: AppContext | undefined;

export async function bootstrap(
  app: FastifyInstance,
  options: BuildAppOptions = {},
): Promise<LiteDatabase> {
  appContext = await createAppContext(options);
  const ctx = appContext;
  await ensurePlatformEnv(ctx.envRepo, ctx.settingsService);
  const authPreHandler = createAuthPreHandler(ctx.authService);
  registerSettingsRoutes(app, ctx, authPreHandler);
  registerWebSearchSettingsRoutes(app, ctx, authPreHandler);
  registerKnowledgeSettingsRoutes(app, ctx, authPreHandler);

  ready = true;

  app.get('/api/health', async () => ({ ok: true }));

  registerSystemRoutes(app, ctx.liteDb, ctx.getRuntimeConfig);
  registerAuthRoutes(app, ctx.liteDb, {
    getRuntimeConfig: ctx.getRuntimeConfig,
    sendResetEmail: async ({ to, resetUrl, productName }) => {
      const runtime = await ctx.getRuntimeConfig();
      const mailer = createMailer(runtime.smtp);
      await mailer.send({
        to,
        subject: `重置您的 ${productName} 密码`,
        text: `您好，\n请点击以下链接重置密码（1 小时内有效）：\n${resetUrl}\n如非本人操作，请忽略此邮件。`,
      });
    },
  });
  registerAdminUserRoutes(app, ctx.liteDb, {
    authPreHandler,
    getRuntimeConfig: ctx.getRuntimeConfig,
  });
  registerMcpTokenRoutes(app, authPreHandler, ctx.authService, ctx.getRuntimeConfig);
  registerPreferencesRoutes(app, ctx.liteDb, authPreHandler, ctx.preferencesRepo);
  registerUserProfileRoutes(app, ctx.liteDb, authPreHandler);

  const standardHealth =
    ctx.profile === 'standard'
      ? createStandardHealthChecker({
          databaseUrl: config.databaseUrl,
          redisUrl: config.redisUrl,
        })
      : null;

  app.get('/api/ready', async (_request, reply) => {
    if (!ready) {
      return reply.status(503).send({ ready: false });
    }
    if (standardHealth) {
      const dep = await standardHealth.check();
      if (!dep.ready) {
        return reply.status(503).send({
          ready: false,
          postgres: dep.postgres,
          redis: dep.redis,
        });
      }
      if (config.redisUrl) {
        const bull = createBullMQQueueProvider({ redisUrl: config.redisUrl });
        const runProbe = bull.provider.runProbe;
        const queueOk = runProbe
          ? await runProbe(async () => undefined, 8000)
          : true;
        if (!queueOk) {
          return reply.status(503).send({
            ready: false,
            postgres: dep.postgres,
            redis: dep.redis,
            queue: false,
          });
        }
      }
      return { ready: true, postgres: dep.postgres, redis: dep.redis, queue: true };
    }
    return { ready: true };
  });

  const collaboratorRepo = createWorkflowCollaboratorRepository(ctx.liteDb);
  const workflowAccess = createWorkflowAccessService({
    collaborators: collaboratorRepo,
    getWorkflowMeta: (id) => ctx.workflowService.getMeta(id),
  });

  registerWorkflowRoutes(
    app,
    ctx.workflowService,
    authPreHandler,
    ctx.executionRuntime,
    {
      collaboratorRepo,
      workflowAccess,
      liteDb: ctx.liteDb,
    },
  );
  registerTemplateRoutes(app, ctx.workflowService, authPreHandler);
  registerExecutionRoutes(app, authPreHandler, ctx.executionRuntime);
  registerCredentialRoutes(app, ctx.liteDb, authPreHandler);
  registerEnvRoutes(app, ctx.envRepo, authPreHandler, ctx.getRuntimeConfig, {
    db: ctx.liteDb,
    gateway: runnerGateway,
  });
  registerVariablesRoutes(app, ctx.variablesRepo, authPreHandler);
  registerAgentMemoryRoutes(app, ctx.agentMemory, authPreHandler);
  registerRunnerRoutes(app, ctx.liteDb, authPreHandler);
  registerSkillRoutes(app, ctx.liteDb, authPreHandler);
  registerRxwfWorkspaceRoutes(app, ctx, authPreHandler);
  registerRulesRoutes(app, authPreHandler);
  registerInstructionContextRoutes(app, authPreHandler);
  registerWorkflowsCatalogRoutes(app, authPreHandler);
  await registerRunnerWebSocket(app, { db: ctx.liteDb, gateway: runnerGateway });
  stopRunnerSweeper = startRunnerOfflineSweeper({
    db: ctx.liteDb,
    gateway: runnerGateway,
  });
  stopHitlSweeper = startHitlTimeoutSweeperForRuntime(ctx.executionRuntime);
  registerI18nRoutes(app);
  registerThemeRoutes(app);
  registerMcpRoutes(app, ctx.liteDb, authPreHandler, ctx.executionRuntime);
  registerWebhookListenRoutes(app, authPreHandler, workflowAccess);
  registerWebhookRoutes(app, ctx.liteDb, () =>
    createApiTriggerIngress(ctx.liteDb, ctx.executionRuntime),
    ctx.executionRuntime,
  );
  registerSetupRoutes(app, ctx.liteDb, ctx.getRuntimeConfig);
  await registerInternalCrewToolRoutes(app, {
    bridgeSecret: ctx.crewToolBridgeSecret,
    invokeCrewTool: ctx.invokeCrewTool,
  });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });
  const credRepo = createLiteCredentialRepository(ctx.liteDb);
  const credentialService = createCredentialService({
    encryptionKey: parseCredentialKey(config.credentialKey),
    insert: (row) => credRepo.insert(row),
    list: () => credRepo.list(),
    findById: (id) => credRepo.findById(id),
    deleteById: (id) => credRepo.deleteById(id),
  });
  await bootstrapPlus(app, ctx.liteDb, authPreHandler, {
    aiRuntime: options.aiRuntime,
    getRuntimeConfig: ctx.getRuntimeConfig,
    getOllamaDefaults: ctx.getOllamaDefaults,
    mcpPool: ctx.mcpPool,
    mcpServerStore: ctx.mcpServerStore,
    credentialResolver: createCredentialResolver(credentialService),
    knowledge: ctx.knowledge,
    getKnowledgePlatformConfig: ctx.getKnowledgePlatformConfig,
    pgDb: ctx.pgDb,
    crewAiRunner: ctx.crewAiRunner,
  });
  await registerInternalCrewCredentialRoutes(app, {
    bridgeSecret: ctx.crewToolBridgeSecret,
    resolveCredentialData: async (credentialRef) => {
      const resolved = await credentialService.resolveForAuth(credentialRef);
      return resolved.data as Record<string, string>;
    },
  });

  if (!options.disableScheduler && !config.schedulerDisabled) {
    const holderId = `api-${process.pid}`;
    const handle = startApiScheduler({
      db: ctx.liteDb,
      holderId,
      intervalMs: config.schedulerTickMs,
    });
    stopScheduler = handle.stop;
  }

  if (!options.disableJobProcessor && !config.jobProcessorDisabled) {
    const needsLiteJobLoop = ctx.profile === 'lite' || Boolean(ctx.knowledge);
    if (needsLiteJobLoop) {
      let overlapSkipped = 0;
      const jobHandle = startJobLoop({
        intervalMs: config.jobProcessorTickMs,
        processOnce: () => ctx.executionRuntime.jobProcessor.processOnce(),
        onSkipOverlap: config.jobProcessorMetrics
          ? () => {
              overlapSkipped += 1;
              console.info(`[jobs] lite loop overlap skipped=${overlapSkipped}`);
            }
          : undefined,
      });
      stopJobLoop = jobHandle.stop;
    }
  }

  app.addHook('onClose', async () => {
    stopScheduler?.();
    stopJobLoop?.();
    stopRunnerSweeper?.();
    stopHitlSweeper?.();
    await ctx.close();
  });

  return ctx.liteDb;
}

/** Test helper: access context after `bootstrap()`. */
export function getBootstrapAppContext(): AppContext | undefined {
  return appContext;
}
