import {
  collectCrewManager,
  collectCrewMembers,
  collectCrewWorkers,
  compileCrewIr,
  crewCredentialBridgeId,
} from '@rxwf/workflow';
import { resolveCrewWorkflowDefinition } from '../expression/resolve-agent-params.js';
import type { AwfCrewIrV1, AwfCrewMemberIr, AwfCrewToolIr } from '@rxwf/workflow';
import type { AgentStepRecord } from '@rxwf/ai-runtime-stub';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { buildOriginalTask } from './crew-helpers.js';
import { enrichCrewIrWithKnowledge } from './crew-knowledge-bridge.js';
import { enrichCrewIrWithMemory, persistCrewMemory } from './crew-memory-bridge.js';
import { CrewAiKickoffError } from './crewai-client.js';
import { runCrewNative, type CrewNodeType } from './crew-native.js';

type CrewExecutionPayload = AwfCrewIrV1['execution'] & {
  toolBridgeTokens?: Record<string, string>;
};

function crewProcessForNodeType(
  crewNodeType: CrewNodeType,
): AwfCrewIrV1['process'] {
  if (crewNodeType === 'crewSequential') return 'sequential';
  if (crewNodeType === 'crewHierarchical') return 'hierarchical';
  return 'supervisor';
}

function collectBridgeIds(member?: AwfCrewMemberIr): string[] {
  if (!member) return [];
  return member.tools
    .filter((t): t is Extract<AwfCrewToolIr, { bridgeId: string }> => 'bridgeId' in t)
    .map((t) => t.bridgeId)
    .filter(Boolean);
}

function collectCredentialRefs(ir: AwfCrewIrV1): string[] {
  const refs = new Set<string>();
  for (const member of [...ir.members, ...(ir.manager ? [ir.manager] : [])]) {
    const ref = member.model.credentialRef?.trim();
    if (ref) refs.add(ref);
  }
  return [...refs];
}

function applyToolBridgeTokens(
  ir: AwfCrewIrV1,
  deps: PlusExecutorDeps,
  executionId: string,
): void {
  const execution = ir.execution as CrewExecutionPayload;
  const baseUrl = deps.crewToolBridgeBaseUrl ?? execution.toolBridgeBaseUrl;

  if (!deps.createCrewToolBridgeToken) {
    execution.toolBridgeToken = '';
    execution.toolBridgeBaseUrl = baseUrl;
    return;
  }

  const tokens: Record<string, string> = {};
  for (const bridgeId of [
    ...ir.members.flatMap((m) => collectBridgeIds(m)),
    ...collectBridgeIds(ir.manager),
    ...collectCredentialRefs(ir).map((ref) => crewCredentialBridgeId(ref)),
  ]) {
    tokens[bridgeId] = deps.createCrewToolBridgeToken(executionId, bridgeId);
  }

  execution.toolBridgeTokens = tokens;
  execution.toolBridgeBaseUrl = baseUrl;
  execution.toolBridgeToken = Object.values(tokens)[0] ?? '';
}

export async function runCrewViaCrewAi(
  ir: AwfCrewIrV1,
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const client = deps.crewAiClient;
  if (!client) {
    return {
      status: 'failed',
      errorCode: 'E1042',
      errorMessage: 'CrewAI sidecar not configured',
    };
  }

  await enrichCrewIrWithKnowledge(ir, ctx, deps);
  await enrichCrewIrWithMemory(ir, ctx, deps);

  let result;
  try {
    if (ctx.onAgentStream) {
      result = await client.kickoffStream(ir, (chunk) => {
        ctx.onAgentStream?.(chunk);
      });
    } else {
      result = await client.kickoff(ir);
    }
  } catch (err) {
    if (err instanceof CrewAiKickoffError) {
      return {
        status: 'failed',
        errorCode: err.code,
        errorMessage: err.message,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      errorCode: 'E1042',
      errorMessage: message || 'CrewAI sidecar kickoff failed',
    };
  }

  if (result.status !== 'success') {
    const code = result.error?.code ?? result.code ?? 'E1042';
    const message =
      result.error?.message ?? result.message ?? 'CrewAI kickoff failed';
    return {
      status: 'failed',
      errorCode: code.startsWith('E') ? code : 'E1042',
      errorMessage: message,
    };
  }

  const answer = result.answer ?? '';
  const crewSteps = result.crewSteps ?? [];
  const agentSteps = (result.agentSteps ?? []) as AgentStepRecord[];
  const crewEval = result.crewEval;

  if (answer) {
    await persistCrewMemory(ir, ctx, deps, ir.inputTask, answer);
  }

  const json: Record<string, unknown> = {
    answer,
    crewSteps,
    process: ir.process,
  };
  if (agentSteps.length > 0) {
    json.agentSteps = agentSteps;
  }
  if (crewEval) {
    json.crewEval = crewEval;
  }

  const metadata: NonNullable<NodeRunResult['metadata']> = {};
  if (agentSteps.length > 0) {
    metadata.agentSteps = agentSteps;
  }
  if (crewEval) {
    metadata.crewEval = crewEval;
  }

  return {
    status: 'success',
    outputItems: [[{ json }]],
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export async function executeCrewNode(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  crewNodeType: CrewNodeType,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const crewNodeId = ctx.nodeId;
  if (!definition || !crewNodeId) {
    const label =
      crewNodeType === 'crewSequential'
        ? 'crewSequential'
        : crewNodeType === 'crewHierarchical'
          ? 'crewHierarchical'
          : 'crewSupervisor';
    const { AwfError } = await import('@rxwf/shared');
    throw new AwfError('E2003', `${label} requires workflow definition context`);
  }

  const process = crewProcessForNodeType(crewNodeType);
  const executionId = ctx.executionId ?? 'local';
  const crewAgentIds = new Set<string>();
  for (const member of collectCrewMembers(definition, crewNodeId)) {
    crewAgentIds.add(member.id);
  }
  const manager = collectCrewManager(definition, crewNodeId);
  if (manager) crewAgentIds.add(manager.id);
  for (const worker of collectCrewWorkers(definition, crewNodeId)) {
    crewAgentIds.add(worker.id);
  }
  const resolvedDefinition = await resolveCrewWorkflowDefinition(
    definition,
    ctx,
    crewAgentIds,
  );
  const ir = compileCrewIr({
    definition: resolvedDefinition,
    crewNodeId,
    process,
    inputTask: buildOriginalTask(ctx.inputItems),
    execution: {
      executionId,
      workflowId: ctx.workflowId ?? '',
      crewNodeId,
      sessionId: ctx.sessionId,
      environment: 'test',
      toolBridgeBaseUrl: deps.crewToolBridgeBaseUrl ?? 'http://127.0.0.1:8787',
      toolBridgeToken: '',
    },
  });

  applyToolBridgeTokens(ir, deps, executionId);

  if (ir.executionBackend === 'crewai') {
    if (!deps.crewAiClient) {
      return {
        status: 'failed',
        errorCode: 'E1042',
        errorMessage: 'CrewAI sidecar not configured',
      };
    }
    return runCrewViaCrewAi(ir, ctx, deps);
  }

  return runCrewNative(ctx, deps, crewNodeType);
}
