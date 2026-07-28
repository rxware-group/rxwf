import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import {
  resolveSubworkflowInputSchema,
  type ResolvedSubworkflowInputSchema,
  type WorkflowNode,
} from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import {
  resolveToolParamWithFromAi,
  substituteFromAiInString,
  type NodeOutputEntry,
} from '@rxwf/expression';
import { resolveItemTemplateString } from '../expression/item-context.js';
import type { NodeExecutionContext } from '../types/node-executor.js';
import {
  resolveToolSatelliteNodeId,
  withSatelliteInvokeTelemetry,
} from '../satellite-stream.js';
import type { PlusExecutorDeps } from './register-plus.js';
import {
  invokeAgentTool,
  isAgentSatelliteToolSource,
  type AgentToolInvokeContext,
} from './agent-satellite-tools.js';
import { runSubagentTool } from './run-subagent-tool.js';
import { runSkillTool } from './run-skill-tool.js';
import { buildSubworkflowPayload } from './build-subworkflow-payload.js';
import { executeHttpRequest } from '../http-request.js';

async function resolveHeadersWithFromAi(
  headers: Record<string, unknown> | undefined,
  toolParams: Record<string, unknown>,
  llmArgs: Record<string, unknown>,
  inputItems: WorkflowItem[],
  env?: Record<string, string>,
  nodes?: NodeOutputEntry[],
  vars?: Record<string, string>,
): Promise<Record<string, unknown> | undefined> {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(headers)) {
    const substituted = substituteFromAiInString(String(raw ?? ''), llmArgs);
    out[key] = await resolveItemTemplateString(
      substituted,
      llmArgs,
      inputItems,
      env,
      nodes,
      vars,
    );
  }
  return out;
}

export type CreateAgentHubInvokeToolOptions = {
  deps: PlusExecutorDeps;
  ctx: NodeExecutionContext;
  toolNodeByName: Map<string, WorkflowNode>;
  agentToolCtx: AgentToolInvokeContext;
  /** Override filesystem/shell/web_search handling (e.g. skillRun web search permissions). */
  invokeBuiltinTool?: (
    def: ToolDefinition,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};

export function createAgentHubInvokeTool(options: CreateAgentHubInvokeToolOptions) {
  const { deps, ctx, toolNodeByName, agentToolCtx } = options;
  const invokeBuiltin =
    options.invokeBuiltinTool ??
    ((def: ToolDefinition, args: Record<string, unknown>) =>
      invokeAgentTool(def, args, agentToolCtx));

  return async (def: ToolDefinition, args: Record<string, unknown>): Promise<unknown> => {
    const toolNodeId = resolveToolSatelliteNodeId(def, toolNodeByName);
    return withSatelliteInvokeTelemetry(ctx, toolNodeId, args, async () => {
      if (isAgentSatelliteToolSource(def.source)) {
        return invokeBuiltin(def, args);
      }
      if (def.source.type === 'mcp') {
        if (!deps.callMcpTool) {
          throw new AwfError('E3012', 'MCP tool runtime not configured');
        }
        return deps.callMcpTool({
          serverId: def.source.serverId,
          toolName: def.source.toolName,
          args,
        });
      }
      if (def.source.type === 'http') {
        const toolNode = toolNodeByName.get(def.name);
        const toolParams = toolNode?.parameters ?? {};
        const urlRaw = resolveToolParamWithFromAi(
          def.source.url,
          'url',
          toolParams,
          args,
        );
        const url = await resolveItemTemplateString(
          urlRaw,
          args,
          ctx.inputItems,
          ctx.env,
          ctx.nodes,
          ctx.vars,
        );
        const headers = await resolveHeadersWithFromAi(
          def.source.headers,
          toolParams,
          args,
          ctx.inputItems,
          ctx.env,
          ctx.nodes,
          ctx.vars,
        );
        let body = def.source.body;
        if (body !== undefined) {
          const bodyRaw = resolveToolParamWithFromAi(body, 'body', toolParams, args);
          body = await resolveItemTemplateString(
            bodyRaw,
            args,
            ctx.inputItems,
            ctx.env,
            ctx.nodes,
            ctx.vars,
          );
        }
        const { statusCode, body: responseBody, requestUrl } = await executeHttpRequest(
          {
            method: def.source.method,
            url,
            headers,
            body,
          },
          args,
          ctx.inputItems,
          ctx.env,
          ctx.nodes,
          ctx.vars,
        );
        if (statusCode < 200 || statusCode >= 300) {
          throw new AwfError('E3012', `HTTP ${statusCode} for ${requestUrl}`);
        }
        return { statusCode, body: responseBody };
      }
      if (def.source.type === 'subagent') {
        const text = await runSubagentTool(
          ctx,
          deps,
          def.source.hubNodeId,
          args,
          ctx.subworkflowDepth ?? 0,
        );
        return { answer: text };
      }
      if (def.source.type === 'skill') {
        const text = await runSkillTool(ctx, deps, def.source, args);
        return { answer: text };
      }
      if (def.source.type === 'workflow') {
        const parentExecutionId = ctx.executionId ?? ctx.parentExecutionId;
        if (!deps.runSubworkflow || !parentExecutionId) {
          throw new AwfError('E3012', 'Workflow tool runtime not configured');
        }
        const toolNode = toolNodeByName.get(def.name);
        const toolParams = toolNode?.parameters ?? {};
        const childDef = deps.loadPublishedWorkflowDefinition
          ? await deps.loadPublishedWorkflowDefinition(def.source.workflowId)
          : null;
        const childSchema = childDef ? resolveSubworkflowInputSchema(childDef) : null;
        const payload = await buildSubworkflowPayload({
          llmArgs: args,
          inputMapping: toolParams.inputMapping,
          childSchema,
          inputItems: ctx.inputItems,
          env: ctx.env,
          nodes: ctx.nodes,
          vars: ctx.vars,
        });
        const child = await deps.runSubworkflow({
          workflowId: def.source.workflowId,
          parentExecutionId,
          depth: (ctx.subworkflowDepth ?? 0) + 1,
          inputItems: [{ json: payload }],
          requireExposeAsTool: true,
        });
        return child.outputItems;
      }
      throw new AwfError('E3012', `Unsupported tool source: ${def.source.type}`);
    });
  };
}

export async function preloadChildWorkflowSchemas(
  deps: PlusExecutorDeps,
  tools: WorkflowNode[],
): Promise<Map<string, ResolvedSubworkflowInputSchema>> {
  const childWorkflowSchemas = new Map<string, ResolvedSubworkflowInputSchema>();
  if (!deps.loadPublishedWorkflowDefinition) return childWorkflowSchemas;
  for (const toolNode of tools) {
    if (toolNode.type !== 'toolWorkflow') continue;
    const workflowId = String(toolNode.parameters.workflowId ?? '').trim();
    if (!workflowId || childWorkflowSchemas.has(workflowId)) continue;
    const childDef = await deps.loadPublishedWorkflowDefinition(workflowId);
    if (!childDef) continue;
    const schema = resolveSubworkflowInputSchema(childDef);
    if (schema) childWorkflowSchemas.set(workflowId, schema);
  }
  return childWorkflowSchemas;
}
