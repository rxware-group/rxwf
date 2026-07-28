import type { WorkflowNode } from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { resolveAgentParameters } from '../expression/resolve-agent-params.js';
import { runAiAgentNode } from './run-ai-agent-node.js';
import { buildCrewRolePrompt, type CrewStepRecord } from './crew-helpers.js';

export async function runCrewWorkerDelegation(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  options: {
    worker: WorkflowNode;
    task: string;
    originalTask: string;
    priorSteps: CrewStepRecord[];
    managerName: string;
  },
): Promise<CrewStepRecord> {
  const { worker, task, originalTask, priorSteps, managerName } = options;
  const delegateItems: WorkflowItem[] = [
    {
      json: {
        managerTask: task,
        originalTask,
        priorSteps,
      },
    },
  ];
  const delegateScope = { ...ctx, inputItems: delegateItems };
  const workerParams = await resolveAgentParameters(worker.parameters, delegateScope);
  const rolePrompt = buildCrewRolePrompt(
    workerParams,
    managerName === 'Supervisor' ? 'supervisor' : 'hierarchical',
  );

  ctx.onAgentStream?.({
    type: 'agent_step',
    step: { crewMember: worker.name, status: 'running', task },
  });

  const result = await runAiAgentNode(ctx, deps, {
    agentNodeId: worker.id,
    agentParams: workerParams,
    inputItems: delegateItems,
    systemMessageExtra: `${rolePrompt}\n\nManager assignment:\n${task}`,
  });

  if (result.status !== 'success') {
    throw new AwfError(
      result.errorCode ?? 'E2003',
      result.errorMessage ?? `Crew worker ${worker.name} failed`,
    );
  }

  const item = result.outputItems?.[0]?.[0];
  const answer = String(item?.json?.answer ?? '');

  ctx.onAgentStream?.({
    type: 'agent_step',
    step: { crewMember: worker.name, status: 'success', output: answer },
  });

  return {
    nodeId: worker.id,
    role: String(worker.parameters.role ?? worker.name),
    name: worker.name,
    answer,
    task,
    delegatedBy: managerName,
  };
}
