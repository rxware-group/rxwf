import { collectSatellites } from '@rxwf/workflow';
import {
  buildAgentToolDefinitions,
} from './agent-satellite-tools.js';
import {
  resolveWebSearchProviderConfig,
  type WebSearchSystemSettings,
} from './resolve-web-search-provider-config.js';
import type {
  AgentRunInput,
  AiExecutionContext,
  ChatMessage,
  ModelRef,
} from '@rxwf/ai-runtime-stub';
import {
  type AgentSatellites,
  type WorkflowNode,
} from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import {
  parseAgentStructuredOutput,
} from '@rxwf/expression';
import {
  resolveInputItemTemplateString,
  type ItemTemplateScope,
} from '../expression/item-context.js';
import { resolveAgentParameters } from '../expression/resolve-agent-params.js';
import {
  resolveAgentPromptRaw,
  resolveAgentSystemMessage,
  resolveAgentUserMessage,
} from '../expression/resolve-agent-prompt.js';
import { buildRagSystemPrompt } from '@rxwf/knowledge';
import type { ScoredChunk } from '@rxwf/providers-contracts';
import {
  createAgentHubInvokeTool,
  preloadChildWorkflowSchemas,
} from './agent-hub-invoke-tool.js';

function parseKnowledgeBaseIds(config: Record<string, unknown>): string[] {
  const raw = config.knowledgeBaseIds;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = String(config.knowledgeBaseId ?? '').trim();
  return single ? [single] : [];
}

async function resolveSessionId(
  satellites: AgentSatellites,
  agentParams: Record<string, unknown>,
  executionSessionId: string | undefined,
  scope: ItemTemplateScope,
  itemIndex = 0,
): Promise<string | null> {
  const candidates = [
    satellites.memory ? String(satellites.memory.parameters.sessionId ?? '') : '',
    String(agentParams.sessionId ?? ''),
    executionSessionId ?? '',
  ];
  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const out = (await resolveInputItemTemplateString(trimmed, scope, itemIndex)).trim();
    if (out) return out;
  }
  return null;
}

function formatKnowledgeChunkForDebug(chunk: ScoredChunk) {
  return {
    text: chunk.text,
    score: chunk.score,
    documentName: chunk.documentName,
    knowledgeBaseId: chunk.knowledgeBaseId,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
  };
}

async function emitMemorySnapshot(
  deps: PlusExecutorDeps,
  memoryNode: WorkflowNode,
  sessionKey: string,
  onSatelliteStream: NonNullable<NodeExecutionContext['onSatelliteStream']>,
): Promise<void> {
  if (!deps.agentMemory) return;
  const maxTurns = Number(memoryNode.parameters.maxTurns ?? 20);
  const limit = Math.max(2, Math.min(100, maxTurns * 2));
  const rows = await deps.agentMemory.listRecent(sessionKey, limit);
  onSatelliteStream(memoryNode.id, {
    type: 'satellite_memory_snapshot',
    sessionId: sessionKey,
    messages: rows.map((row) => ({
      role: row.role,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

function modelFromChatModelNode(params: Record<string, unknown>): ModelRef {
  return {
    provider: String(params.provider ?? 'ollama'),
    model: String(params.model ?? 'llama3'),
    baseUrl: params.baseUrl ? String(params.baseUrl) : undefined,
    credentialId: params.credentialId ? String(params.credentialId) : undefined,
  };
}

function outputSchemaFromParserNode(parser: WorkflowNode): Record<string, unknown> | undefined {
  const raw = parser.parameters.jsonSchema;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export interface RunAiAgentNodeOptions {
  agentNodeId: string;
  agentParams: Record<string, unknown>;
  inputItems?: WorkflowItem[];
  systemMessageExtra?: string;
}

export async function runAiAgentNode(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  options: RunAiAgentNodeOptions,
): Promise<NodeRunResult> {
  if (!deps.ai) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }
  const definition = ctx.workflowDefinition;
  const agentNodeId = options.agentNodeId;
  if (!definition || !agentNodeId) {
    throw new AwfError('E2003', 'AI Agent requires workflow definition context');
  }

  const satellites = collectSatellites(definition, agentNodeId);
  const chatModel = satellites.model;
  if (!chatModel) {
    return {
      status: 'failed',
      errorCode: 'E3010',
      errorMessage: 'AI Agent has no connected Chat Model',
    };
  }
  const inputItems = options.inputItems ?? ctx.inputItems;
  const itemCount = Math.max(1, inputItems.length);
  const templateScope: ItemTemplateScope = { ...ctx, inputItems };

  const outputParserNode = satellites.outputParser;
  const outputSchema = outputParserNode
    ? outputSchemaFromParserNode(outputParserNode)
    : undefined;
  if (outputParserNode && ctx.onSatelliteStream) {
    ctx.onSatelliteStream(outputParserNode.id, {
      type: 'satellite_schema_read',
      schema: outputSchema ?? outputParserNode.parameters.jsonSchema,
    });
  }

  const workspaceRoot = String(options.agentParams.workspaceRoot ?? process.cwd()).trim();
  const scanRoots = workspaceRoot ? [workspaceRoot] : [process.cwd()];

  const childWorkflowSchemas = await preloadChildWorkflowSchemas(deps, satellites.tools);

  const tools = buildAgentToolDefinitions(satellites.tools, {
    childWorkflowSchemas,
    locale: ctx.locale,
  });
  const toolNodeByName = new Map<string, WorkflowNode>();
  for (const toolNode of satellites.tools) {
    toolNodeByName.set(toolNode.name.trim(), toolNode);
  }

  const agentToolCtx = {
    scanRoots,
    executionId: ctx.executionId,
    nodeRunId: agentNodeId,
    runnerGateway: deps.runnerGateway,
    webSearch: deps.webSearch,
    resolveWebSearchProviderConfig:
      deps.loadWebSearchSettings && deps.resolveWebSearchCredential
        ? async (toolNodeId: string) => {
            const toolNode = satellites.tools.find((t) => t.id === toolNodeId);
            if (!toolNode || toolNode.type !== 'toolWebSearch') return undefined;
            const systemSettings = await deps.loadWebSearchSettings!();
            return resolveWebSearchProviderConfig({
              toolNode,
              workflowSettings: definition.settings,
              systemSettings: systemSettings as WebSearchSystemSettings,
              resolveCredential: deps.resolveWebSearchCredential,
            });
          }
        : undefined,
  };

  const invokeTool = createAgentHubInvokeTool({
    deps,
    ctx,
    toolNodeByName,
    agentToolCtx,
  });

  const outputRow: WorkflowItem[] = [];

  for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
    const agentParams = await resolveAgentParameters(
      options.agentParams,
      templateScope,
      inputItems,
      itemIndex,
    );
    const userMessage = await resolveAgentUserMessage(
      options.agentParams,
      templateScope,
      itemIndex,
    );
    if (!userMessage.trim() && resolveAgentPromptRaw(options.agentParams).trim()) {
      const emptyPromptError =
        itemCount > 1
          ? `Prompt resolved to empty for input item ${itemIndex + 1}`
          : 'Prompt resolved to empty for structured output';
      ctx.onAgentStream?.({
        type: 'agent_step',
        step: {
          kind: 'structuredOutputFailed',
          itemIndex: itemIndex + 1,
          itemCount,
          userMessage: '',
          answer: '',
          error: emptyPromptError,
          errorCode: 'E3013',
        },
      });
      throw new AwfError('E3013', emptyPromptError);
    }
    ctx.onAgentStream?.({
      type: 'agent_step',
      step: {
        kind: 'agentItemStart',
        itemIndex: itemIndex + 1,
        itemCount,
        userMessage,
      },
    });
    let systemMessage = await resolveAgentSystemMessage(
      options.agentParams,
      templateScope,
      itemIndex,
    );
    if (options.systemMessageExtra?.trim()) {
      systemMessage = [systemMessage, options.systemMessageExtra]
        .filter((s) => s.trim())
        .join('\n\n');
    }

    if (satellites.knowledge && deps.knowledge) {
      const kbIds = parseKnowledgeBaseIds(satellites.knowledge.parameters);
      if (kbIds.length > 0 && userMessage.trim()) {
        const chunks = await deps.knowledge.queryMany(kbIds, userMessage);
        if (chunks.length > 0) {
          const ragBlock = buildRagSystemPrompt(chunks, 'support');
          systemMessage = [systemMessage, ragBlock].filter((s) => s.trim()).join('\n\n');
        }
        ctx.onSatelliteStream?.(satellites.knowledge.id, {
          type: 'satellite_knowledge_query',
          query: userMessage,
          knowledgeBaseIds: kbIds,
          chunks: chunks.map(formatKnowledgeChunkForDebug),
        });
      }
    }

    const sessionKey = await resolveSessionId(
      satellites,
      agentParams,
      ctx.sessionId,
      templateScope,
      itemIndex,
    );

    let history: ChatMessage[] | undefined;
    if (deps.agentMemory && sessionKey) {
      const maxTurns = satellites.memory
        ? Number(satellites.memory.parameters.maxTurns ?? 20)
        : 20;
      const limit = Math.max(2, Math.min(100, maxTurns * 2));
      const rows = await deps.agentMemory.listRecent(sessionKey, limit);
      history = rows
        .filter((r) => r.role === 'user' || r.role === 'assistant' || r.role === 'system')
        .map((r) => ({
          role: r.role as ChatMessage['role'],
          content: r.content,
        }));
    }

    const onSatelliteStream = ctx.onSatelliteStream
      ? (satelliteNodeId: string, chunk: Parameters<NonNullable<typeof ctx.onSatelliteStream>>[1]) => {
          ctx.onSatelliteStream!(satelliteNodeId, chunk);
        }
      : undefined;

    const aiCtx: AiExecutionContext = {
      executionId: ctx.executionId ?? '',
      workflowId: ctx.workflowId ?? '',
      nodeId: agentNodeId,
      environment: 'test',
      sessionId: sessionKey ?? ctx.sessionId,
      onStream: ctx.onAgentStream,
      modelNodeId: chatModel.id,
      onSatelliteStream,
    };

    const runInput: AgentRunInput = {
      model: modelFromChatModelNode(chatModel.parameters),
      systemPrompt: systemMessage.trim() || undefined,
      userMessage,
      tools,
      history,
      maxIterations: Number(agentParams.maxIterations ?? 10),
      timeoutMs: Number(agentParams.timeoutMs ?? 120_000),
      returnIntermediateSteps: agentParams.returnIntermediateSteps !== false,
      outputSchema,
      invokeTool,
    };

    const result = await deps.ai.runAgent(runInput, aiCtx);
    const answer = String(result.items[0]?.json.answer ?? '');
    let parsed: Record<string, unknown> | undefined;
    if (outputSchema) {
      try {
        parsed = parseAgentStructuredOutput(answer, outputSchema);
      } catch (err) {
        const message = err instanceof AwfError ? err.message : String(err);
        const code = err instanceof AwfError ? err.code : 'E3013';
        ctx.onAgentStream?.({
          type: 'agent_step',
          step: {
            kind: 'structuredOutputFailed',
            itemIndex: itemIndex + 1,
            itemCount,
            userMessage,
            systemMessage: systemMessage.trim(),
            answer: answer.trim() ? answer : '(empty)',
            outputSchema,
            error: message,
            errorCode: code,
          },
        });
        throw err;
      }
    }
    if (deps.agentMemory && sessionKey) {
      await deps.agentMemory.append({
        sessionId: sessionKey,
        role: 'user',
        content: userMessage,
        executionId: ctx.executionId,
      });
      await deps.agentMemory.append({
        sessionId: sessionKey,
        role: 'assistant',
        content: answer,
        executionId: ctx.executionId,
      });
      if (satellites.memory && onSatelliteStream) {
        await emitMemorySnapshot(deps, satellites.memory, sessionKey, onSatelliteStream);
      }
    }

    outputRow.push({
      json: {
        answer,
        ...(parsed ? { parsed } : {}),
        agentSteps: result.intermediateSteps ?? result.items[0]?.json.agentSteps,
      },
    });
  }

  return {
    status: 'success',
    outputItems: [outputRow],
  };
}
