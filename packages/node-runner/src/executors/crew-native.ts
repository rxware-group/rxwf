import {
  collectCrewManager,
  collectCrewMembers,
  collectCrewWorkers,
} from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { resolveAgentParameters } from '../expression/resolve-agent-params.js';
import { runAiAgentNode } from './run-ai-agent-node.js';
import {
  askCrewManager,
  askCrewSupervisor,
  buildCrewRolePrompt,
  buildOriginalTask,
  resolveSupervisorModel,
  type CrewStepRecord,
} from './crew-helpers.js';
import { runCrewAssignments } from './crew-delegate-batch.js';

export type CrewNodeType = 'crewSequential' | 'crewHierarchical' | 'crewSupervisor';

function configFlag(value: unknown, defaultTrue = true): boolean {
  if (value === undefined || value === null) return defaultTrue;
  return String(value).toLowerCase() !== 'false';
}

async function runCrewSequentialNative(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const crewNodeId = ctx.nodeId;
  if (!definition || !crewNodeId) {
    throw new AwfError('E2003', 'crewSequential requires workflow definition context');
  }

  const members = collectCrewMembers(definition, crewNodeId);
  if (members.length < 2) {
    return {
      status: 'failed',
      errorCode: 'E1030',
      errorMessage: 'Crew Sequential requires at least two connected aiAgent members',
    };
  }

  const crewSteps: CrewStepRecord[] = [];
  let carryItems: WorkflowItem[] = ctx.inputItems;
  let finalAnswer = '';

  for (const member of members) {
    const memberScope = { ...ctx, inputItems: carryItems };
    const memberParams = await resolveAgentParameters(member.parameters, memberScope);
    const rolePrompt = buildCrewRolePrompt(memberParams, 'sequential');
    ctx.onAgentStream?.({
      type: 'agent_step',
      step: { crewMember: member.name, status: 'running' },
    });

    const result = await runAiAgentNode(ctx, deps, {
      agentNodeId: member.id,
      agentParams: memberParams,
      inputItems: carryItems,
      systemMessageExtra: rolePrompt,
    });

    if (result.status !== 'success') {
      return {
        status: 'failed',
        errorCode: result.errorCode ?? 'E2003',
        errorMessage: result.errorMessage ?? `Crew member ${member.name} failed`,
      };
    }

    const item = result.outputItems?.[0]?.[0];
    finalAnswer = String(item?.json?.answer ?? '');
    crewSteps.push({
      nodeId: member.id,
      role: String(memberParams.role ?? member.name),
      name: member.name,
      answer: finalAnswer,
    });

    ctx.onAgentStream?.({
      type: 'agent_step',
      step: { crewMember: member.name, status: 'success', output: finalAnswer },
    });

    carryItems = [
      {
        json: {
          priorMember: member.name,
          priorRole: String(memberParams.role ?? ''),
          priorAnswer: finalAnswer,
        },
      },
    ];
  }

  return {
    status: 'success',
    outputItems: [
      [
        {
          json: {
            answer: finalAnswer,
            crewSteps,
          },
        },
      ],
    ],
  };
}

async function runCrewHierarchicalNative(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const crewNodeId = ctx.nodeId;
  if (!definition || !crewNodeId) {
    throw new AwfError('E2003', 'crewHierarchical requires workflow definition context');
  }

  const manager = collectCrewManager(definition, crewNodeId);
  if (!manager) {
    return {
      status: 'failed',
      errorCode: 'E1031',
      errorMessage: 'Crew Hierarchical requires a manager aiAgent on crew_manager port',
    };
  }

  const workers = collectCrewWorkers(definition, crewNodeId, {
    excludeNodeId: manager.id,
  });
  if (workers.length < 1) {
    return {
      status: 'failed',
      errorCode: 'E1032',
      errorMessage:
        'Crew Hierarchical requires at least one worker aiAgent on crew_member port',
    };
  }

  const maxRounds = Math.max(1, Math.min(20, Number(ctx.config.maxDelegations ?? 10)));
  const allowParallel = configFlag(ctx.config.allowParallelDelegation, true);
  const originalTask = buildOriginalTask(ctx.inputItems);
  const crewSteps: CrewStepRecord[] = [];
  let finalAnswer = '';

  for (let round = 0; round < maxRounds; round++) {
    let decision;
    try {
      decision = await askCrewManager(
        deps,
        ctx,
        definition,
        manager,
        workers,
        originalTask,
        crewSteps,
        allowParallel,
      );
    } catch (err) {
      const code = err instanceof AwfError ? err.code : 'E1033';
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'failed', errorCode: code, errorMessage: message };
    }

    ctx.onAgentStream?.({
      type: 'agent_step',
      step: { crewManager: manager.name, decision, round },
    });

    if (decision.action === 'finish') {
      finalAnswer = decision.answer?.trim() || '';
      if (!finalAnswer && crewSteps.length > 0) {
        finalAnswer = crewSteps.at(-1)!.answer;
      }
      break;
    }

    try {
      if (decision.action === 'delegate_parallel') {
        const newSteps = await runCrewAssignments(
          ctx,
          deps,
          workers,
          decision.assignments,
          originalTask,
          crewSteps,
          manager.name,
          true,
        );
        crewSteps.push(...newSteps);
        finalAnswer = newSteps.at(-1)?.answer ?? finalAnswer;
      } else {
        const newSteps = await runCrewAssignments(
          ctx,
          deps,
          workers,
          [{ member: decision.member, task: decision.task }],
          originalTask,
          crewSteps,
          manager.name,
          false,
        );
        crewSteps.push(...newSteps);
        finalAnswer = newSteps[0]?.answer ?? finalAnswer;
      }
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
        };
      }
      return {
        status: 'failed',
        errorCode: 'E2003',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!finalAnswer && crewSteps.length === 0) {
    return {
      status: 'failed',
      errorCode: 'E1033',
      errorMessage: 'Crew Hierarchical completed without worker steps',
    };
  }

  return {
    status: 'success',
    outputItems: [
      [
        {
          json: {
            answer: finalAnswer,
            crewSteps,
            process: 'hierarchical',
          },
        },
      ],
    ],
  };
}

async function runCrewSupervisorNative(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const crewNodeId = ctx.nodeId;
  if (!definition || !crewNodeId) {
    throw new AwfError('E2003', 'crewSupervisor requires workflow definition context');
  }

  const manager = collectCrewManager(definition, crewNodeId);
  const workers = collectCrewWorkers(definition, crewNodeId, {
    excludeNodeId: manager?.id,
  });
  if (workers.length < 1) {
    return {
      status: 'failed',
      errorCode: 'E1032',
      errorMessage:
        'Crew Supervisor requires at least one worker aiAgent on crew_member port',
    };
  }

  let supervisorModel;
  try {
    supervisorModel = resolveSupervisorModel(definition, crewNodeId, ctx.config);
  } catch (err) {
    const code = err instanceof AwfError ? err.code : 'E1035';
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', errorCode: code, errorMessage: message };
  }

  const maxSteps = Math.max(1, Math.min(30, Number(ctx.config.maxSteps ?? 15)));
  const allowParallel = configFlag(ctx.config.allowParallel, true);
  const originalTask = buildOriginalTask(ctx.inputItems);
  const crewSteps: CrewStepRecord[] = [];
  const supervisorSteps: Array<Record<string, unknown>> = [];
  let finalAnswer = '';
  const delegatorName = manager?.name ?? 'Supervisor';

  for (let step = 0; step < maxSteps; step++) {
    let decision;
    try {
      decision = await askCrewSupervisor(
        deps,
        supervisorModel,
        workers,
        originalTask,
        crewSteps,
        step,
        allowParallel,
      );
    } catch (err) {
      const code = err instanceof AwfError ? err.code : 'E1033';
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'failed', errorCode: code, errorMessage: message };
    }

    supervisorSteps.push({ step, decision });
    ctx.onAgentStream?.({
      type: 'agent_step',
      step: { supervisor: delegatorName, decision, stepIndex: step },
    });

    if (decision.action === 'finish') {
      finalAnswer = decision.answer?.trim() || '';
      if (!finalAnswer && crewSteps.length > 0) {
        finalAnswer = crewSteps.at(-1)!.answer;
      }
      break;
    }

    try {
      if (decision.action === 'run_parallel') {
        const newSteps = await runCrewAssignments(
          ctx,
          deps,
          workers,
          decision.assignments,
          originalTask,
          crewSteps,
          delegatorName,
          true,
        );
        crewSteps.push(...newSteps);
        finalAnswer = newSteps.at(-1)?.answer ?? finalAnswer;
      } else {
        const newSteps = await runCrewAssignments(
          ctx,
          deps,
          workers,
          [{ member: decision.member, task: decision.task }],
          originalTask,
          crewSteps,
          delegatorName,
          false,
        );
        crewSteps.push(...newSteps);
        finalAnswer = newSteps[0]?.answer ?? finalAnswer;
      }
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
        };
      }
      return {
        status: 'failed',
        errorCode: 'E2003',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!finalAnswer && crewSteps.length === 0) {
    return {
      status: 'failed',
      errorCode: 'E1033',
      errorMessage: 'Crew Supervisor completed without worker steps',
    };
  }

  return {
    status: 'success',
    outputItems: [
      [
        {
          json: {
            answer: finalAnswer,
            crewSteps,
            supervisorSteps,
            process: 'supervisor',
          },
        },
      ],
    ],
  };
}

export async function runCrewNative(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  crewNodeType: CrewNodeType,
): Promise<NodeRunResult> {
  switch (crewNodeType) {
    case 'crewSequential':
      return runCrewSequentialNative(ctx, deps);
    case 'crewHierarchical':
      return runCrewHierarchicalNative(ctx, deps);
    case 'crewSupervisor':
      return runCrewSupervisorNative(ctx, deps);
    default: {
      const _exhaustive: never = crewNodeType;
      return _exhaustive;
    }
  }
}
