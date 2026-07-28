import type { WorkflowNode } from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import {
  resolveWorkerByMemberKey,
  type CrewAssignment,
  type CrewStepRecord,
} from './crew-helpers.js';
import { runCrewWorkerDelegation } from './crew-run-worker.js';

export async function runCrewAssignments(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  workers: WorkflowNode[],
  assignments: CrewAssignment[],
  originalTask: string,
  crewSteps: CrewStepRecord[],
  delegatorName: string,
  parallel: boolean,
): Promise<CrewStepRecord[]> {
  const jobs = assignments.map(async (assignment) => {
    const worker = resolveWorkerByMemberKey(workers, assignment.member);
    if (!worker) {
      throw new AwfError(
        'E1034',
        `Delegated to unknown member: ${assignment.member}`,
      );
    }
    const task = assignment.task.trim() || originalTask;
    return runCrewWorkerDelegation(ctx, deps, {
      worker,
      task,
      originalTask,
      priorSteps: crewSteps,
      managerName: delegatorName,
    });
  });

  if (parallel) {
    return Promise.all(jobs);
  }
  const results: CrewStepRecord[] = [];
  for (const job of jobs) {
    results.push(await job);
  }
  return results;
}
