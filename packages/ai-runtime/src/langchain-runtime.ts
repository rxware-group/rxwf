import { AwfError } from '@rxwf/shared';
import { createModelSatelliteCallbacks } from './model-satellite-callbacks.js';
import type {
  AgentRunInput,
  AgentRunResult,
  AiChatOptions,
  AiExecutionContext,
  AiRuntime,
  ChatMessage,
  GroupChatRunInput,
  GroupChatRunResult,
  ModelRef,
  ToolDefinition,
} from '@rxwf/ai-runtime-stub';
import { runGroupChatGraph } from './agents/group-chat-agent.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { buildOutputParserSystemHint } from '@rxwf/expression';
import {
  buildAgentPromptSnapshot,
  chatHistoryToLangChainMessages,
  extractLangChainMessageText,
  lastAssistantAnswerFromMessages,
  resolveLlmResponsesForAgentRun,
} from './message-content.js';

async function synthesizeStructuredAnswer(
  llm: BaseChatModel,
  transcript: BaseMessage[],
  invokeOpts?: { signal?: AbortSignal; callbacks?: BaseCallbackHandler[] },
): Promise<string> {
  const res = await llm.invoke(
    [...transcript, new HumanMessage('Provide your final answer now.')],
    invokeOpts,
  );
  return extractLangChainMessageText(res.content);
}

function reactAgentUsedTools(steps: unknown[]): boolean {
  return steps.some((step) => {
    if (!step || typeof step !== 'object') return false;
    const type = (step as { type?: unknown }).type;
    return type === 'tool_start' || type === 'tool_end';
  });
}

function jsonSchemaPropertyToZod(prop: Record<string, unknown>): z.ZodTypeAny {
  const type = String(prop.type ?? 'string');
  const description = prop.description ? String(prop.description) : undefined;
  let schema: z.ZodTypeAny;
  switch (type) {
    case 'number':
    case 'integer':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'object':
      schema = z.record(z.unknown());
      break;
    case 'array':
      schema = z.array(z.unknown());
      break;
    default:
      schema = z.string();
  }
  return description ? schema.describe(description) : schema;
}

function buildZodFromToolParameters(parameters: Record<string, unknown>): z.ZodObject<any> {
  const properties =
    parameters.properties && typeof parameters.properties === 'object'
      ? (parameters.properties as Record<string, Record<string, unknown>>)
      : {};
  const required = Array.isArray(parameters.required)
    ? (parameters.required as string[])
    : [];
  if (Object.keys(properties).length === 0) {
    return z.object({}).passthrough();
  }
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(properties)) {
    let field = jsonSchemaPropertyToZod(prop);
    if (!required.includes(key)) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}

export interface LangChainRuntimeOptions {
  ollama?: { baseUrl: string; defaultModel?: string };
  credentialResolver?: (credentialId: string) => Promise<Record<string, string>>;
  /** Test-only: bypass network model creation */
  createChatModel?: (model: ModelRef) => BaseChatModel;
}

function resolveRunAgentSignal(
  timeoutMs: number,
  ctxSignal?: AbortSignal,
): { signal?: AbortSignal; cleanup: () => void } {
  if (timeoutMs <= 0) {
    return { signal: ctxSignal, cleanup: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let signal: AbortSignal = controller.signal;
  if (ctxSignal) {
    if (ctxSignal.aborted) {
      controller.abort();
    } else {
      ctxSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  return {
    signal,
    cleanup: () => clearTimeout(timer),
  };
}

/** LangSmith: set LANGCHAIN_TRACING_V2, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT on the API process. */
export function createLangChainAiRuntime(
  options: LangChainRuntimeOptions = {},
): AiRuntime {
  const resolveCredentials =
    options.credentialResolver ??
    (async (): Promise<Record<string, string>> => ({}));

  async function buildChatModel(modelRef: ModelRef): Promise<BaseChatModel> {
    if (options.createChatModel) return options.createChatModel(modelRef);
    if (modelRef.provider === 'ollama') {
      return new ChatOllama({
        model: modelRef.model,
        baseUrl: modelRef.baseUrl ?? options.ollama?.baseUrl ?? 'http://127.0.0.1:11434',
      });
    }
    if (modelRef.provider === 'openai-compatible') {
      const creds = modelRef.credentialId
        ? await resolveCredentials(modelRef.credentialId)
        : ({} as Record<string, string>);
      const apiKey =
        creds.apiKey ??
        creds.accessToken ??
        creds.API_KEY ??
        process.env.OPENAI_API_KEY ??
        '';
      return new ChatOpenAI({
        model: modelRef.model,
        apiKey,
        configuration: modelRef.baseUrl ? { baseURL: modelRef.baseUrl } : undefined,
      });
    }
    throw new AwfError('E3001', `Unsupported model provider: ${modelRef.provider}`);
  }

  function toLangChainTools(
    defs: ToolDefinition[],
    invokeTool: (def: ToolDefinition, args: Record<string, unknown>) => Promise<unknown>,
  ) {
    return defs.map((def) =>
      tool(
        async (args: Record<string, unknown>) => {
          const result = await invokeTool(def, args);
          return typeof result === 'string' ? result : JSON.stringify(result);
        },
        {
          name: def.name,
          description: def.description,
          schema: buildZodFromToolParameters(def.parameters),
        },
      ),
    );
  }

  return {
    async *chat(
      messages: ChatMessage[],
      opts?: AiChatOptions,
    ): AsyncGenerator<string, void, unknown> {
      const signal = opts?.signal;
      if (signal?.aborted) return;

      const modelRef: ModelRef = opts?.model ?? {
        provider: 'ollama',
        model: options.ollama?.defaultModel ?? 'llama3',
        baseUrl: options.ollama?.baseUrl,
      };
      const model = await buildChatModel(modelRef);
      if (signal?.aborted) return;

      const lcMessages: BaseMessage[] = messages.map((m) =>
        m.role === 'system'
          ? new SystemMessage(m.content)
          : new HumanMessage(m.content),
      );

      for await (const chunk of await model.stream(
        lcMessages,
        signal ? { signal } : undefined,
      )) {
        if (signal?.aborted) return;
        const part = extractLangChainMessageText(chunk.content);
        if (part) yield part;
      }
    },

    async runAgent(
      input: AgentRunInput,
      ctx: AiExecutionContext,
    ): Promise<AgentRunResult> {
      const { signal, cleanup } = resolveRunAgentSignal(input.timeoutMs, ctx.signal);
      let flushPendingInvocations = () => {};
      let getRoundOutputs = () => [] as string[];
      try {
        if (signal?.aborted) {
          throw new AwfError('E2004', 'Agent execution aborted');
        }
        const llm = await buildChatModel(input.model);
        const modelSatelliteCallbacks = createModelSatelliteCallbacks(ctx, {
          initialPromptMessages: buildAgentPromptSnapshot(input),
        });
        const modelCallbacks = modelSatelliteCallbacks.handlers;
        flushPendingInvocations = modelSatelliteCallbacks.flushPendingInvocations;
        getRoundOutputs = modelSatelliteCallbacks.getRoundOutputs;
        const steps: unknown[] = [];

      const invokeTool = async (
        def: ToolDefinition,
        args: Record<string, unknown>,
      ): Promise<unknown> => {
        ctx.onStream?.({ type: 'tool_start', tool: def.name, input: args });
        steps.push({ type: 'tool_start', tool: def.name, input: args });
        try {
          if (input.invokeTool) {
            const out = await input.invokeTool(def, args);
            ctx.onStream?.({ type: 'tool_end', tool: def.name, output: out });
            steps.push({ type: 'tool_end', tool: def.name, output: out });
            return out;
          }
          throw new AwfError(
            'E3012',
            `Tool runtime not wired for ${def.name} (configure node-runner deps)`,
          );
        } catch (err) {
          const message =
            err instanceof AwfError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Tool call failed';
          ctx.onStream?.({
            type: 'agent_step',
            step: { tool: def.name, status: 'failed', message },
          });
          steps.push({
            type: 'tool_end',
            tool: def.name,
            output: { error: message },
          });
          if (err instanceof AwfError) throw err;
          throw new AwfError('E3012', message);
        }
      };

      if (input.tools.length === 0) {
        const messages: BaseMessage[] = [];
        let systemPrompt = input.systemPrompt ?? '';
        if (input.outputSchema && Object.keys(input.outputSchema).length > 0) {
          systemPrompt = [systemPrompt, buildOutputParserSystemHint(input.outputSchema)]
            .filter((s) => s.trim())
            .join('\n\n');
        }
        if (systemPrompt) messages.push(new SystemMessage(systemPrompt));
        messages.push(...chatHistoryToLangChainMessages(input.history ?? []));
        messages.push(new HumanMessage(input.userMessage));
        const res = await llm.invoke(messages, {
          ...(signal ? { signal } : {}),
          ...(modelCallbacks.length ? { callbacks: modelCallbacks } : {}),
        });
        const answer = extractLangChainMessageText(res.content);
        ctx.onStream?.({ type: 'token', content: answer });
        const llmResponses = resolveLlmResponsesForAgentRun(getRoundOutputs(), [res]).filter(
          (text) => text.trim().length > 0,
        );
        return {
          items: [{ json: { answer, agentSteps: steps, llmResponses } }],
          intermediateSteps: input.returnIntermediateSteps ? steps : undefined,
        };
      }

      const agent = createReactAgent({
        llm,
        tools: toLangChainTools(input.tools, invokeTool),
      });

      const messages: BaseMessage[] = [];
      let systemPrompt = input.systemPrompt ?? '';
      if (input.outputSchema && Object.keys(input.outputSchema).length > 0) {
        systemPrompt = [systemPrompt, buildOutputParserSystemHint(input.outputSchema)]
          .filter((s) => s.trim())
          .join('\n\n');
      }
      if (systemPrompt) messages.push(new SystemMessage(systemPrompt));
      messages.push(...chatHistoryToLangChainMessages(input.history ?? []));
      messages.push(new HumanMessage(input.userMessage));

      try {
        const result = await agent.invoke(
          { messages },
          {
            recursionLimit: input.maxIterations + 2,
            ...(signal ? { signal } : {}),
            ...(modelCallbacks.length ? { callbacks: modelCallbacks } : {}),
          },
        );
        const outMessages = (result as { messages?: BaseMessage[] }).messages ?? [];
        let answer = lastAssistantAnswerFromMessages(outMessages);
        const invokeOpts = {
          ...(signal ? { signal } : {}),
          ...(modelCallbacks.length ? { callbacks: modelCallbacks } : {}),
        };
        const hasOutputSchema =
          input.outputSchema != null &&
          Object.keys(input.outputSchema).length > 0;
        if (!answer.trim() && hasOutputSchema) {
          if (!reactAgentUsedTools(steps)) {
            const res = await llm.invoke(messages, invokeOpts);
            answer = extractLangChainMessageText(res.content);
          } else {
            answer = await synthesizeStructuredAnswer(
              llm,
              outMessages,
              invokeOpts,
            );
          }
          ctx.onStream?.({ type: 'token', content: answer });
        }
        const llmResponses = resolveLlmResponsesForAgentRun(
          getRoundOutputs(),
          outMessages,
        ).filter((text) => text.trim().length > 0);
        return {
          items: [{ json: { answer, agentSteps: steps, llmResponses } }],
          intermediateSteps: input.returnIntermediateSteps ? steps : undefined,
        };
      } catch (err) {
        if (signal?.aborted) {
          throw new AwfError('E2004', 'Agent execution aborted');
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('recursion') || msg.includes('iteration')) {
          throw new AwfError('E3004', 'Agent reached max iterations');
        }
        throw err;
      }
      } finally {
        flushPendingInvocations();
        cleanup();
      }
    },

    async runGroupChat(
      input: GroupChatRunInput,
      ctx: AiExecutionContext,
    ): Promise<GroupChatRunResult> {
      async function chatOrchestrator(
        model: ModelRef,
        system: string,
        user: string,
      ): Promise<string> {
        if (ctx.signal?.aborted) {
          throw new AwfError('E2004', 'Group chat execution aborted');
        }
        const llm = await buildChatModel(model);
        const res = await llm.invoke([new SystemMessage(system), new HumanMessage(user)]);
        const text = extractLangChainMessageText(res.content);
        ctx.onStream?.({ type: 'token', content: text });
        return text;
      }

      return runGroupChatGraph(input, { chatOrchestrator });
    },
  };
}
