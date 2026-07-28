import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  applySchema,
  createLiteAgentMemoryRepository,
  createLiteCredentialRepository,
  createLiteEnvRepository,
  createLiteVariablesRepository,
  createLitePreferencesRepository,
  createLiteRunnerRepository,
  createLiteWorkflowRepository,
  createLiteModelCatalogRepository,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createMcpClientPool } from '@rxwf/mcp-client-pool';
import { createCredentialService } from '@rxwf/credential';
import {
  createStandardAgentMemoryRepository,
  createStandardEnvRepository,
  createStandardVariablesRepository,
  createStandardWorkflowRepository,
  openStandardDatabase,
  type StandardDatabase,
} from '@rxwf/providers-standard';
import { createCallMcpTool } from './mcp-servers/create-call-mcp-tool.js';
import { createMcpServerStore } from './mcp-servers/store.js';
import { createCredentialResolver } from './credentials/create-credential-resolver.js';
import { parseCredentialKey } from '@rxwf/credential';
import { createAuthService, type AuthService } from '@rxwf/identity';
import { createWorkflowService } from '@rxwf/workflow';
import type { EnvRepositoryPort } from '@rxwf/env';
import {
  resolvePlatformEnvMap,
  type PlatformEnvDefaults,
} from '@rxwf/env';
import { buildRuntimeConfigFromPlatformEnv } from './env/build-runtime-config.js';
import type { VariablesRepositoryPort } from '@rxwf/variables';
import {
  createSystemSettingsService,
  SETTING_KEYS,
  type RuntimeConfig,
  type SystemSettingsService,
} from '@rxwf/system-settings';
import {
  createModelCatalogService,
  resolveWorkflowOllamaDefaults,
} from '@rxwf/model-catalog';
import type { AgentMemoryRepository } from '@rxwf/providers-contracts';
import type { BuildAppOptions } from './build-options.js';
import { config, envDefaults } from './config.js';
import {
  createExecutionRuntime,
  createExecutionRuntimeFromDeps,
  type CreateExecutionRuntimeOptions,
  type ExecutionRuntime,
} from './execution/create-execution-runtime.js';
import { createKnowledgeRuntime, type KnowledgeRuntime } from './knowledge/create-knowledge-runtime.js';
import { loadKnowledgePlatformConfig } from './knowledge/load-platform-config.js';
import { seedKnowledgePlatformConfig } from './knowledge/seed-platform-config.js';
import type { KnowledgePlatformConfig } from '@rxwf/knowledge';
import type { InvokeCrewToolFn } from './execution/crew-tool-bridge-types.js';
import {
  createCrewToolBridgeTokenFactory,
  initCrewAiRunner,
  type CrewAiRunnerInit,
} from './bootstrap-plus.js';
import { runnerGateway } from './runners/gateway-instance.js';
import { createWebSearchService, loadWebSearchSettings } from './web-search/create-web-search-service.js';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const defaultInvokeCrewTool: InvokeCrewToolFn = async () => {
  throw new Error('E1045: crew tool bridge handler not configured');
};

export type { InvokeCrewToolFn } from './execution/crew-tool-bridge-types.js';

export interface AppContext {
  profile: 'lite' | 'standard';
  /** Present when deploy profile is standard (PostgreSQL pool for knowledge pgvector). */
  pgPool?: { end(): Promise<void> };
  pgDb?: StandardDatabase;
  authService: AuthService;
  workflowService: ReturnType<typeof createWorkflowService>;
  executionRuntime: ExecutionRuntime;
  envRepo: EnvRepositoryPort;
  variablesRepo: VariablesRepositoryPort;
  preferencesRepo: ReturnType<typeof createLitePreferencesRepository>;
  runnerRepo: ReturnType<typeof createLiteRunnerRepository>;
  liteDb: LiteDatabase;
  settingsService: SystemSettingsService;
  getRuntimeConfig: () => Promise<RuntimeConfig>;
  getOllamaDefaults: () => Promise<{ ollamaUrl: string; ollamaModel: string }>;
  agentMemory: AgentMemoryRepository;
  mcpPool?: ReturnType<typeof createMcpClientPool>;
  mcpServerStore?: ReturnType<typeof createMcpServerStore>;
  knowledge?: KnowledgeRuntime;
  getKnowledgePlatformConfig: () => Promise<KnowledgePlatformConfig>;
  invokeCrewTool: InvokeCrewToolFn;
  crewToolBridgeSecret: string;
  crewAiRunner: CrewAiRunnerInit;
  close: () => Promise<void>;
}

function detectPlatform(): {
  os: 'windows' | 'linux' | 'macos';
  arch: 'x64' | 'arm64' | 'arm';
} {
  let os: 'windows' | 'linux' | 'macos' = 'linux';
  if (process.platform === 'win32') os = 'windows';
  else if (process.platform === 'darwin') os = 'macos';
  let arch: 'x64' | 'arm64' | 'arm' = 'x64';
  if (process.arch === 'arm64') arch = 'arm64';
  else if (process.arch === 'arm') arch = 'arm';
  return { os, arch };
}

async function openLiteDb(): Promise<LiteDatabase> {
  await mkdir(config.dataDir, { recursive: true });
  const dbPath = join(config.dataDir, 'rxwf.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  applySchema(sqlite);
  return drizzle(sqlite, { schema: liteSchema });
}

export async function createAppContext(
  options: BuildAppOptions = {},
): Promise<AppContext> {
  const platform = detectPlatform();

  const liteDb = options.db ?? (await openLiteDb());
  const encryptionKey = parseCredentialKey(config.credentialKey);
  const settingsService = createSystemSettingsService(liteDb, encryptionKey);
  let envRepo: EnvRepositoryPort = createLiteEnvRepository(liteDb);
  const platformEnvDefaults = (): PlatformEnvDefaults & {
    ollamaUrl: string;
    ollamaModel: string;
  } => ({
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
    ollamaUrl: envDefaults.ollamaUrl,
    ollamaModel: envDefaults.ollamaModel,
  });
  const loadRuntimeConfig = () =>
    buildRuntimeConfigFromPlatformEnv(envRepo, platformEnvDefaults());
  const catalogService = createModelCatalogService({
    repo: createLiteModelCatalogRepository(liteDb),
  });
  const getOllamaDefaults = () =>
    loadRuntimeConfig().then((cfg) =>
      resolveWorkflowOllamaDefaults(catalogService, {
        ollamaUrl: cfg.ollamaUrl,
        ollamaModel: cfg.ollamaModel,
      }),
    );
  const invokeCrewTool = options.invokeCrewTool ?? defaultInvokeCrewTool;
  const crewToolBridgeSecret = config.crewToolBridgeSecret;
  const crewToolBridgeBaseUrl =
    envDefaults.publicUrl ?? `http://127.0.0.1:${config.httpPort}`;
  const crewAiRunner = await initCrewAiRunner({
    getRemoteBaseUrls: () => runnerGateway.listOnlineCrewAiSidecarUrls(),
  });
  const workflowValidateOptions = {
    get crewaiRunnerConfigured(): boolean {
      if (crewAiRunner.crewAiHealthy) return true;
      if (process.env.CREWAI_RUNNER_URL?.trim()) return crewAiRunner.crewAiHealthy;
      return runnerGateway.listOnlineCrewAiSidecarUrls().length > 0;
    },
    ...(config.crewaiAllowedBuiltinTools.length > 0
      ? { allowedCrewaiBuiltinTools: config.crewaiAllowedBuiltinTools }
      : {}),
  };
  const plusCrewRuntimeOpts = {
    crewAiClient: crewAiRunner.crewAiClient,
    createCrewToolBridgeToken: createCrewToolBridgeTokenFactory(crewToolBridgeSecret),
    crewToolBridgeBaseUrl,
  };

  const mcpPool = createMcpClientPool({ maxClients: 3 });
  const mcpServerStore = createMcpServerStore(config.dataDir);
  const callMcpTool = createCallMcpTool({ store: mcpServerStore, pool: mcpPool });
  let agentMemory = createLiteAgentMemoryRepository(liteDb);
  const credRepo = createLiteCredentialRepository(liteDb);
  const credentialService = createCredentialService({
    encryptionKey,
    insert: (row) => credRepo.insert(row),
    list: () => credRepo.list(),
    findById: (id) => credRepo.findById(id),
    deleteById: (id) => credRepo.deleteById(id),
  });
  const credentialResolver = createCredentialResolver(credentialService);

  if (options.seedKnowledgePlatformConfig || process.env.RXWF_SEED_KNOWLEDGE_PLATFORM === '1') {
    await seedKnowledgePlatformConfig(liteDb, settingsService);
  }

  const getKnowledgePlatformConfig = () => loadKnowledgePlatformConfig(settingsService);

  const webSearch = await createWebSearchService({
    settingsService,
    credentialResolver,
  });

  const runtimeOptsBase = {
    getOllamaDefaults,
    getRuntimeConfig: loadRuntimeConfig,
    callMcpTool,
    agentMemory,
    credentialResolver,
    credentialService,
    webSearch,
    loadWebSearchSettings: () => loadWebSearchSettings(settingsService),
    getRxwfWorkspaceRoot: async () => {
      const map = await resolvePlatformEnvMap(envRepo, platformEnvDefaults());
      return map.RXWF_WORKSPACE_ROOT ?? '';
    },
    getKnowledgePlatformConfig,
    resolveModelRef: (id: string) => catalogService.resolveModelRef(id),
    ...plusCrewRuntimeOpts,
  };

  if (config.deployProfile === 'standard' && config.databaseUrl) {
    const { pool, db: pgDb } = await openStandardDatabase(config.databaseUrl);

    let knowledge: KnowledgeRuntime | undefined;
    knowledge = await createKnowledgeRuntime({
      profile: 'standard',
      liteDb,
      pgPool: pool,
      pgDb,
      dataDir: config.dataDir,
      getPlatformConfig: getKnowledgePlatformConfig,
      credentialResolver,
      redisUrl: config.redisUrl,
      bullmqConcurrency: Number.isFinite(config.bullmqKnowledgeConcurrency)
        ? Math.max(1, Math.floor(config.bullmqKnowledgeConcurrency))
        : 2,
      createEmbeddings: options.createEmbeddings,
    });

    const runtimeOpts: CreateExecutionRuntimeOptions = {
      ...runtimeOptsBase,
      extraJobHandlers: knowledge?.jobHandlers,
      knowledgeQuery: knowledge
        ? {
            queryMany: (ids, q) => knowledge!.service.queryMany(ids, q),
          }
        : undefined,
    };
    const runnerRepo = createLiteRunnerRepository(liteDb);
    await runnerRepo.ensureEmbedded(platform, ['code', 'shell', 'file', 'ssh', 'http']);

    const workflowService = createWorkflowService(createStandardWorkflowRepository(pgDb), {
      validateOptions: workflowValidateOptions,
    });
    const envRepoPg = createStandardEnvRepository(pgDb);
    envRepo = envRepoPg;
    const variablesRepo = createStandardVariablesRepository(pgDb);

    agentMemory = createStandardAgentMemoryRepository(pgDb);

    const executionRuntime = await createExecutionRuntimeFromDeps(
      {
        liteDb,
        pgDb,
        useBullMQ: Boolean(config.redisUrl),
        redisUrl: config.redisUrl,
        bullmqExecutionConcurrency: Number.isFinite(config.bullmqExecutionConcurrency)
          ? Math.max(1, Math.floor(config.bullmqExecutionConcurrency))
          : 4,
      },
      platform,
      { ...runtimeOpts, agentMemory },
    );

    return {
      profile: 'standard',
      pgPool: pool,
      pgDb,
      mcpPool,
      mcpServerStore,
      knowledge,
      authService: createAuthService(liteDb),
      workflowService,
      executionRuntime,
      envRepo: envRepoPg,
      variablesRepo,
      preferencesRepo: createLitePreferencesRepository(liteDb),
      runnerRepo,
      liteDb,
      settingsService,
      getRuntimeConfig: loadRuntimeConfig,
      getOllamaDefaults,
      getKnowledgePlatformConfig,
      agentMemory,
      invokeCrewTool,
      crewToolBridgeSecret,
      crewAiRunner,
      close: async () => {
        await knowledge?.stopWorkers?.();
        await executionRuntime.close?.();
        await pool.end();
      },
    };
  }

  const knowledge = await createKnowledgeRuntime({
    profile: 'lite',
    liteDb,
    dataDir: config.dataDir,
    getPlatformConfig: getKnowledgePlatformConfig,
    credentialResolver,
    bullmqConcurrency: Number.isFinite(config.bullmqKnowledgeConcurrency)
      ? Math.max(1, Math.floor(config.bullmqKnowledgeConcurrency))
      : 2,
    createEmbeddings: options.createEmbeddings,
  });

  const runtimeOpts: CreateExecutionRuntimeOptions = {
    ...runtimeOptsBase,
    extraJobHandlers: knowledge?.jobHandlers,
    knowledgeQuery: knowledge
      ? {
          queryMany: (ids, q) => knowledge!.service.queryMany(ids, q),
        }
      : undefined,
  };

  const runnerRepo = createLiteRunnerRepository(liteDb);
  await runnerRepo.ensureEmbedded(platform, ['code', 'shell', 'file', 'ssh', 'http']);

  const executionRuntime = await createExecutionRuntime(liteDb, platform, runtimeOpts);

  return {
    profile: 'lite',
    mcpPool,
    mcpServerStore,
    knowledge,
    authService: createAuthService(liteDb),
    workflowService: createWorkflowService(createLiteWorkflowRepository(liteDb), {
      validateOptions: workflowValidateOptions,
    }),
    executionRuntime,
    envRepo: envRepo,
    variablesRepo: createLiteVariablesRepository(liteDb),
    preferencesRepo: createLitePreferencesRepository(liteDb),
    runnerRepo,
    liteDb,
    settingsService,
    getRuntimeConfig: loadRuntimeConfig,
    getOllamaDefaults,
    getKnowledgePlatformConfig,
    agentMemory,
    invokeCrewTool,
    crewToolBridgeSecret,
    crewAiRunner,
    close: async () => {
      await knowledge?.stopWorkers?.();
      await executionRuntime.close?.();
    },
  };
}
