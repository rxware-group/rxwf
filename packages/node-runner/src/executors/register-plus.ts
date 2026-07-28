import type { AiRuntime, ModelRef } from '@rxwf/ai-runtime-stub';
import type {
  AgentMemoryRepository,
  RunnerGatewayPort,
  RunnerRecord,
  ScoredChunk,
  WebSearchPort,
} from '@rxwf/providers-contracts';
import type { NodeRunnerOverride, RunnerPolicy } from '@rxwf/workflow';
import type { NodeExecutor } from '../types/node-executor.js';
import type { ExecutorRegistry } from '../registry/executor-registry.js';
import type { McpClientHandle } from '@rxwf/mcp-client-pool';
import { createAiAgentExecutor } from './ai-agent.js';
import { registerSkillExecutors } from './register-skill.js';
import { createCrewSequentialExecutor } from './crew-sequential.js';
import { createCrewHierarchicalExecutor } from './crew-hierarchical.js';
import { createCrewSupervisorExecutor } from './crew-supervisor.js';
import { createGroupChatExecutor } from './group-chat.js';
import { createRagExecutors } from './rag.js';
import type {
  SubworkflowExecutorDeps,
  SubworkflowRunChildInput,
  SubworkflowRunChildResult,
} from './subworkflow.js';
import type { CrewAiClient } from './crewai-client.js';
import { readWriteFileExecutor } from './read-write-file.js';
import { createPostgresExecutor } from './postgres.js';
import { createLlmExecutor } from './llm.js';
import { createLlmStreamExecutor } from './llm-stream.js';

export interface PlusExecutorDeps {
  ai?: AiRuntime;
  /** Resolve Ollama model (and base URL) per node config + system settings */
  resolveOllamaModelRef?: (
    nodeConfig: Record<string, unknown>,
  ) => Promise<ModelRef>;
  agentMemory?: AgentMemoryRepository;
  mcpClient?: McpClientHandle;
  callMcpTool?: (input: {
    serverId: string;
    toolName: string;
    args?: Record<string, unknown>;
  }) => Promise<unknown>;
  runSubworkflow?: SubworkflowExecutorDeps['runChild'];
  /** Run ephemeral compiled workflow as child (P3 workflow_run). */
  runCompiledWorkflow?: (
    input: Omit<SubworkflowRunChildInput, 'workflowId' | 'requireExposeAsTool'> & {
      definition: import('@rxwf/workflow').WorkflowDefinition;
    },
  ) => Promise<SubworkflowRunChildResult>;
  knowledge?: {
    queryMany(knowledgeBaseIds: string[], queryText: string): Promise<ScoredChunk[]>;
  };
  crewAiClient?: CrewAiClient;
  createCrewToolBridgeToken?: (executionId: string, bridgeId: string) => string;
  crewToolBridgeBaseUrl?: string;
  runnerGateway?: RunnerGatewayPort;
  webSearch?: WebSearchPort;
  resolveWebSearchCredential?: (credentialId: string) => Promise<Record<string, string>>;
  loadWebSearchSettings?: () => Promise<import('./resolve-web-search-provider-config.js').WebSearchSystemSettings>;
  resolveRunnerForSkill?: (input: {
    nodeRunner?: NodeRunnerOverride;
    workflowRunnerPolicy?: RunnerPolicy;
    preferRemote?: boolean;
  }) => Promise<RunnerRecord>;
  /** Load SKILL.md from lite skill registry (skillSource=registry). */
  loadSkillFromRegistry?: (
    skillId: string,
  ) => Promise<{ skillRelPath: string; skillMd: string } | null>;
  /** RxWF workspace root from system settings (skillSource=registry). */
  getRxwfWorkspaceRoot?: () => Promise<string>;
  /** When true, `toolIntentMode: auto` appends stronger tool directives (Plus). */
  toolIntentModeAuto?: boolean;
  /** Load published workflow definition for toolWorkflow / executeWorkflow schema. */
  loadPublishedWorkflowDefinition?: (
    workflowId: string,
  ) => Promise<import('@rxwf/workflow').WorkflowDefinition | null>;
  /** Standard profile PostgreSQL URL for postgres node fallback. */
  databaseUrl?: string;
  /** Resolve platform RAG default model from knowledge.config + model catalog. */
  resolvePlatformRagModelRef?: () => Promise<ModelRef>;
}

export function registerPlusExecutors(
  registry: ExecutorRegistry,
  deps: PlusExecutorDeps = {},
): void {
  const executors: NodeExecutor[] = [
    createAiAgentExecutor(deps),
    createCrewSequentialExecutor(deps),
    createCrewHierarchicalExecutor(deps),
    createCrewSupervisorExecutor(deps),
    createGroupChatExecutor(deps),
    ...createRagExecutors(deps),
    {
      type: 'splitInBatches',
      async execute(ctx) {
        const batchSize = Number(ctx.config.batchSize ?? 1);
        const items = ctx.inputItems;
        const batches: typeof items[] = [];
        for (let i = 0; i < items.length; i += batchSize) {
          batches.push(items.slice(i, i + batchSize));
        }
        return {
          status: 'success',
          outputItems: batches.length ? batches : [items],
        };
      },
    },
    readWriteFileExecutor,
    createPostgresExecutor({ databaseUrl: deps.databaseUrl }),
    createLlmExecutor(deps),
    createLlmStreamExecutor(deps),
    {
      type: 'mcpClient',
      async execute(ctx) {
        if (!deps.mcpClient) {
          const { AwfError } = await import('@rxwf/shared');
          throw new AwfError('E3011', 'MCP client not connected');
        }
        const toolList = Array.isArray(ctx.config.tools)
          ? (ctx.config.tools as unknown[]).filter(
              (t): t is string => typeof t === 'string' && t.length > 0,
            )
          : ctx.config.tool
            ? [String(ctx.config.tool)]
            : ['list_directory'];
        const args = ctx.config.args as Record<string, unknown> | undefined;
        const results: Array<{ tool: string; result: unknown }> = [];
        for (const tool of toolList) {
          results.push({
            tool,
            result: await deps.mcpClient.callTool(tool, args),
          });
        }
        return {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  tools: results,
                  tool: results[0]?.tool,
                  result: results[0]?.result,
                },
              },
            ],
          ],
        };
      },
    },
  ];
  for (const ex of executors) {
    registry.register(ex);
  }
  registerSkillExecutors(registry, deps);
}
