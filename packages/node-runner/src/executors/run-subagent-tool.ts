import {
  collectSubagentSatellites,
  hasInputMappingOverride,
  resolveSubworkflowInputSchema,
  type ResolvedSubworkflowInputSchema,
} from '@rxwf/workflow';
import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import {
  buildJsonSchemaFromFromAiSpecs,
  collectFromAiSpecsFromToolParams,
} from '@rxwf/expression';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { buildSubworkflowPayload } from './build-subworkflow-payload.js';
import {
  emitSubagentRunEnd,
  emitSubagentRunStart,
  wrapSubagentExecutionStreams,
} from './forward-subagent-stream.js';
import { buildRuleSystemAppendix } from './rule-inject.js';
import { runAiAgentNode } from './run-ai-agent-node.js';

const DEFAULT_MAX_AGENT_DEPTH = 2;

export async function runSubagentTool(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  hubNodeId: string,
  llmArgs: Record<string, unknown>,
  parentDepth: number,
): Promise<string> {
  if (!deps.ai || !ctx.workflowDefinition) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }
  const byId = new Map(ctx.workflowDefinition.nodes.map((n) => [n.id, n]));
  const hub = byId.get(hubNodeId);
  if (!hub || hub.type !== 'toolSubagent') {
    throw new AwfError('E2003', 'toolSubagent hub not found');
  }
  const maxDepth = Number(
    ctx.workflowDefinition.settings?.maxAgentDepth ?? DEFAULT_MAX_AGENT_DEPTH,
  );
  if (parentDepth + 1 > maxDepth) {
    throw new AwfError('E1048', 'maxAgentDepth exceeded for toolSubagent');
  }

  const p = hub.parameters;
  const childTools = collectSubagentSatellites(ctx.workflowDefinition, hubNodeId);
  if (p.readonly === true || p.readonly === 'true') {
    const hasWorkflow = childTools.some((t) => t.type === 'toolWorkflow');
    if (hasWorkflow) {
      throw new AwfError('E1050', 'readonly subagent cannot use toolWorkflow');
    }
  }

  const taskTemplate = String(p.taskPromptTemplate ?? 'Complete the subtask.');
  const userMessage =
    typeof taskTemplate === 'string'
      ? taskTemplate.replace(/\{\{\s*\$fromAI\.(\w+)\s*\}\}/g, (_, key: string) =>
          String(llmArgs[key] ?? llmArgs[key.trim()] ?? ''),
        )
      : JSON.stringify(llmArgs);

  const workspaceRoot = String(p.workspaceRoot ?? process.cwd());
  const ruleAppendix = await buildRuleSystemAppendix({
    ruleMode: (p.ruleMode as 'off' | 'inherit' | 'explicit') ?? 'off',
    ruleSources: Array.isArray(p.ruleSources) ? (p.ruleSources as string[]) : undefined,
    workspaceRoot,
    maxRuleTokens: Number(p.maxRuleTokens ?? 0) || undefined,
  });
  const systemPrompt = String(p.systemPrompt ?? '') + ruleAppendix;

  const syntheticAgentId = `${hubNodeId}__subagent`;
  const syntheticDef = {
    ...ctx.workflowDefinition,
    nodes: [
      ...ctx.workflowDefinition.nodes,
      {
        id: syntheticAgentId,
        type: 'aiAgent',
        name: `${hub.name} (sub)`,
        position: hub.position,
        parameters: {
          promptType: 'define',
          text: userMessage,
          systemMessage: systemPrompt,
          maxIterations: Number(p.maxIterations ?? 8),
          timeoutMs: Number(p.timeoutMs ?? 90_000),
          provider: p.provider,
          model: p.model,
          baseUrl: p.baseUrl,
          credentialId: p.credentialId,
        },
      },
    ],
    connections: [
      ...ctx.workflowDefinition.connections,
      ...childTools.map((t) => ({
        from: t.id,
        to: syntheticAgentId,
        fromOutput: 'ai_tool',
        toInput: 'ai_tool',
      })),
    ],
  };

  const streamForwarding = wrapSubagentExecutionStreams(ctx, hubNodeId);
  const subCtx: NodeExecutionContext = {
    ...ctx,
    workflowDefinition: syntheticDef,
    nodeId: syntheticAgentId,
    subworkflowDepth: parentDepth + 1,
    ...streamForwarding,
  };

  emitSubagentRunStart(ctx, hubNodeId, userMessage);

  const result = await runAiAgentNode(subCtx, deps, {
    agentNodeId: syntheticAgentId,
    agentParams: syntheticDef.nodes.find((n) => n.id === syntheticAgentId)!.parameters,
  });

  if (result.status !== 'success') {
    throw new AwfError(result.errorCode ?? 'E3001', result.errorMessage ?? 'subagent failed');
  }
  const answer = String(result.outputItems?.[0]?.[0]?.json.answer ?? '');
  emitSubagentRunEnd(ctx, hubNodeId, answer);
  const maxTokens = Number(p.maxSubagentResultTokens ?? 4000);
  if (answer.length > maxTokens * 4) {
    return `${answer.slice(0, maxTokens * 4)}\n…[truncated]`;
  }
  return answer;
}

export function subagentToolDefinition(
  hubNode: { id: string; name: string; parameters: Record<string, unknown> },
  parameters: Record<string, unknown>,
): ToolDefinition {
  return {
    name: hubNode.name.trim(),
    description: String(parameters.toolDescription ?? 'Run a sub-agent'),
    parameters: { type: 'object', properties: {} },
    source: { type: 'subagent', hubNodeId: hubNode.id },
  };
}

function toolWorkflowParameters(
  params: Record<string, unknown>,
  childSchema: ResolvedSubworkflowInputSchema | undefined,
): Record<string, unknown> {
  if (hasInputMappingOverride(params)) {
    return buildJsonSchemaFromFromAiSpecs(collectFromAiSpecsFromToolParams(params));
  }
  if (childSchema) {
    return childSchema.jsonSchema;
  }
  return buildJsonSchemaFromFromAiSpecs(collectFromAiSpecsFromToolParams(params));
}

export function workflowToolDefinition(
  toolNode: { id: string; name: string; parameters: Record<string, unknown> },
  parameters: Record<string, unknown>,
  childSchema?: ResolvedSubworkflowInputSchema,
): ToolDefinition {
  const workflowId = String(parameters.workflowId ?? '');
  return {
    name: toolNode.name.trim(),
    description: String(parameters.toolDescription ?? 'Run a workflow tool'),
    parameters: toolWorkflowParameters(parameters, childSchema),
    source: { type: 'workflow', workflowId },
  };
}

export async function runToolWorkflow(
  deps: PlusExecutorDeps,
  ctx: NodeExecutionContext,
  workflowId: string,
  toolParams: Record<string, unknown>,
  llmArgs: Record<string, unknown>,
): Promise<unknown> {
  const parentExecutionId = ctx.executionId ?? ctx.parentExecutionId;
  if (!deps.runSubworkflow || !parentExecutionId) {
    throw new AwfError('E3012', 'Workflow tool runtime not configured');
  }
  const childDef = deps.loadPublishedWorkflowDefinition
    ? await deps.loadPublishedWorkflowDefinition(workflowId)
    : null;
  const childSchema = childDef ? resolveSubworkflowInputSchema(childDef) : null;
  const payload = await buildSubworkflowPayload({
    llmArgs,
    inputMapping: toolParams.inputMapping,
    childSchema,
    inputItems: ctx.inputItems,
    env: ctx.env,
    nodes: ctx.nodes,
    vars: ctx.vars,
  });
  const child = await deps.runSubworkflow({
    workflowId,
    parentExecutionId,
    depth: (ctx.subworkflowDepth ?? 0) + 1,
    inputItems: [{ json: payload }],
    requireExposeAsTool: true,
  });
  return child.outputItems;
}
