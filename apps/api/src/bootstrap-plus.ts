import { createLangChainAiRuntime } from '@rxwf/ai-runtime';

import { createChatService } from '@rxwf/chat';

import { createMcpClientPool } from '@rxwf/mcp-client-pool';

import { createPluginHost } from '@rxwf/plugin-host';

import {
  createResolvableCrewAiClient,
  createExecutorRegistry,
  type CrewAiClient,
} from '@rxwf/node-runner';

import { createChatBotService, configToResolved } from '@rxwf/chat-bots';
import type { KnowledgePlatformConfig } from '@rxwf/knowledge';
import {
  createLiteChatBotsRepository,
  createLiteChatRepository,
  createLiteModelCatalogRepository,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import {
  createStandardChatBotsRepository,
  createStandardChatRepository,
  createStandardModelCatalogRepository,
  type StandardDatabase,
} from '@rxwf/providers-standard';

import type { FastifyInstance } from 'fastify';

import type { RuntimeConfig } from '@rxwf/system-settings';

import { config, envDefaults } from './config.js';

import { registerChatRoutes } from './routes/chat.js';
import { registerChatBotRoutes } from './routes/chat-bots.js';
import { registerPublicChatRoutes } from './routes/public-chat.js';
import { setChatBotMcpBindings } from './mcp/chat-bot-mcp.js';
import { setSkillMcpBindings } from './mcp/skill-mcp-handlers.js';

import { registerAdminRoutes } from './routes/admin.js';

import { registerPluginRoutes } from './routes/plugins.js';

import { registerMcpServerRoutes } from './routes/mcp-servers.js';

import { registerKnowledgeBaseRoutes } from './routes/knowledge-bases.js';
import { registerModelRoutes } from './routes/models.js';

import { createMcpServerStore } from './mcp-servers/store.js';

import { createModelCatalogService, resolveWorkflowOllamaDefaults } from '@rxwf/model-catalog';

import type { AiRuntime } from '@rxwf/ai-runtime-stub';

import type { BuildAppOptions } from './build-options.js';

import type { createAuthPreHandler } from './middleware/auth.js';

import type { KnowledgeRuntime } from './knowledge/create-knowledge-runtime.js';

import { createCrewToolBridgeToken } from './execution/crew-tool-bridge-token.js';



export interface PlusRuntime {

  chatService: ReturnType<typeof createChatService>;

  mcpPool: ReturnType<typeof createMcpClientPool>;

}

export interface CrewAiRunnerInit {
  crewAiClient?: CrewAiClient;
  crewAiHealthy: boolean;
}

const CREW_TOOL_BRIDGE_TOKEN_TTL_MS = 15 * 60 * 1000;

export async function initCrewAiRunner(deps?: {
  getRemoteBaseUrls?: () => string[];
}): Promise<CrewAiRunnerInit> {
  const timeoutMs = Number(process.env.CREWAI_RUNNER_TIMEOUT_MS ?? 300_000);
  const envUrl = process.env.CREWAI_RUNNER_URL?.trim();
  const client = createResolvableCrewAiClient({
    envBaseUrl: envUrl,
    getRemoteBaseUrls: deps?.getRemoteBaseUrls ?? (() => []),
    timeoutMs,
  });
  const ok = await client.health().catch(() => false);
  return { crewAiClient: client, crewAiHealthy: ok };
}

export function createCrewToolBridgeTokenFactory(secret: string) {
  return (executionId: string, bridgeId: string): string =>
    createCrewToolBridgeToken({
      secret,
      executionId,
      bridgeId,
      expiresAtMs: Date.now() + CREW_TOOL_BRIDGE_TOKEN_TTL_MS,
    });
}



export async function bootstrapPlus(

  app: FastifyInstance,

  db: LiteDatabase,

  authPreHandler: ReturnType<typeof createAuthPreHandler>,

  options: Pick<BuildAppOptions, 'aiRuntime'> & {

    getRuntimeConfig?: () => Promise<RuntimeConfig>;

    getOllamaDefaults?: () => Promise<{ ollamaUrl: string; ollamaModel: string }>;

    mcpPool?: ReturnType<typeof createMcpClientPool>;

    mcpServerStore?: ReturnType<typeof createMcpServerStore>;

    credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;

    knowledge?: KnowledgeRuntime;

    getKnowledgePlatformConfig: () => Promise<KnowledgePlatformConfig>;

    pgDb?: StandardDatabase;

    crewAiRunner?: CrewAiRunnerInit;
  } = {},

): Promise<PlusRuntime> {

  if (
    options.crewAiRunner?.crewAiClient &&
    !options.crewAiRunner.crewAiHealthy
  ) {
    app.log.warn('CREWAI_RUNNER_URL set but health check failed');
  }

  const runtime = options.getRuntimeConfig ? await options.getRuntimeConfig() : null;
  const catalogRepo = options.pgDb
    ? createStandardModelCatalogRepository(options.pgDb)
    : createLiteModelCatalogRepository(db);
  const catalogService = createModelCatalogService({ repo: catalogRepo });
  const ollamaDefaults = options.getOllamaDefaults
    ? await options.getOllamaDefaults()
    : await resolveWorkflowOllamaDefaults(catalogService, {
        ollamaUrl: runtime?.ollamaUrl ?? envDefaults.ollamaUrl,
        ollamaModel: runtime?.ollamaModel ?? envDefaults.ollamaModel,
      });

  const ai: AiRuntime =

    options.aiRuntime ??

    createLangChainAiRuntime({

      ollama: {
        baseUrl: ollamaDefaults.ollamaUrl,
        defaultModel: ollamaDefaults.ollamaModel,
      },

      credentialResolver: options.credentialResolver,

    });

  const knowledgePort = options.knowledge

    ? {

        queryMany: (knowledgeBaseIds: string[], queryText: string) =>

          options.knowledge!.service.queryMany(knowledgeBaseIds, queryText),

      }

    : undefined;

  const usePgChat = Boolean(options.pgDb);
  const chatBotsRepo = usePgChat
    ? createStandardChatBotsRepository(options.pgDb!)
    : createLiteChatBotsRepository(db);
  const chatBotService = createChatBotService({ repo: chatBotsRepo });

  const chatRepo = usePgChat
    ? createStandardChatRepository(options.pgDb!)
    : createLiteChatRepository(db);

  const chatService = createChatService({

    repo: chatRepo,

    ai,

    knowledge: knowledgePort,

    bots: {
      getDraftConfig: async (botId, userId) =>
        configToResolved(await chatBotService.getDraftConfig(botId, userId)),
      resolvePublishedConfig: (versionId) => chatBotService.resolvePublishedConfig(versionId),
      resolveForSession: (input) => chatBotService.resolveForSession(input),
    },

    catalog: {
      resolveModelRef: (id) => catalogService.resolveModelRef(id),
      getDefaultChatModelId: async () => {
        const ms = await catalogService.listModels();
        return ms.find((m) => m.isDefaultChat)?.id ?? ms[0]?.id ?? null;
      },
    },

    platform: {
      getRagDefaultModelId: async () => {
        const cfg = await options.getKnowledgePlatformConfig();
        const id = cfg.rag.defaultModelId?.trim();
        return id || null;
      },
    },

  });

  const mcpPool = options.mcpPool ?? createMcpClientPool({ maxClients: 3 });

  const pluginHost = createPluginHost({

    registry: createExecutorRegistry(),

    signingSecret: config.pluginSigningSecret,

  });



  const mcpServerStore = options.mcpServerStore ?? createMcpServerStore(config.dataDir);

  registerChatRoutes(app, authPreHandler, chatService);

  registerChatBotRoutes(app, authPreHandler, chatBotService, chatService, ai);
  registerPublicChatRoutes(app, chatService, chatBotService, chatRepo);
  setChatBotMcpBindings({ chatBots: chatBotService, chatService, chatRepo });
  setSkillMcpBindings({ ai, defaultWorkspaceRoot: process.cwd() });

  if (options.knowledge) {

    registerKnowledgeBaseRoutes(
      app,
      authPreHandler,
      options.knowledge.service,
      db,
      options.getKnowledgePlatformConfig,
    );

  }

  registerAdminRoutes(app, authPreHandler);

  registerPluginRoutes(app, authPreHandler, pluginHost);

  registerMcpServerRoutes(app, authPreHandler, mcpServerStore, mcpPool);

  registerModelRoutes(app, authPreHandler, catalogService);

  return { chatService, mcpPool };

}

