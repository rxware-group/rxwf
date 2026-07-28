import type { WorkflowItem } from '@rxwf/shared';
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutionEngine } from '../engine/execution-engine.js';
import type { FacadeNodeRunResult, NodeRunJob } from '../engine/execution-engine.js';
import { toWorkflowGraph } from '../graph/to-workflow-graph.js';
import type { ErrorWorkflowPayload } from '../error-workflow/error-payload.js';

export interface ExecutionRunnerDeps {
  executeNodeRun(job: NodeRunJob): Promise<FacadeNodeRunResult>;
  updateExecutionStatus(
    executionId: string,
    status: 'running' | 'success' | 'failed' | 'waiting',
  ): Promise<void>;
}

export interface RunStoredExecutionInput {
  executionId: string;
  definition: WorkflowDefinition;
  mode: NodeRunJob['mode'];
  initialItems?: WorkflowItem[];
  parentExecutionId?: string;
  subworkflowDepth?: number;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  workflowId?: string;
  sessionId?: string;
  onAgentStream?: (chunk: AiStreamChunk) => void;
  errorPayload?: ErrorWorkflowPayload;
}

export function createExecutionRunner(deps: ExecutionRunnerDeps) {
  const engine = createExecutionEngine({
    executeNodeRun: (job) => deps.executeNodeRun(job),
  });

  return {
    async runStoredExecution(input: RunStoredExecutionInput): Promise<{
      status: 'success' | 'failed' | 'waiting';
      finalOutputItems?: WorkflowItem[];
      waitingNodeId?: string;
    }> {
      await deps.updateExecutionStatus(input.executionId, 'running');
      const { graph, startNodeId } = toWorkflowGraph(input.definition);
      const result = await engine.run({
        executionId: input.executionId,
        graph,
        startNodeId,
        initialItems: input.initialItems ?? [{ json: {} }],
        mode: input.mode,
        workflowSettings: input.definition.settings ?? {},
        env: input.env,
        vars: input.vars,
        parentExecutionId: input.parentExecutionId,
        subworkflowDepth: input.subworkflowDepth,
        workflowDefinition: input.definition,
        workflowId: input.workflowId,
        sessionId: input.sessionId,
        onAgentStream: input.onAgentStream,
        errorPayload: input.errorPayload,
      });
      if (result.status === 'waiting') {
        await deps.updateExecutionStatus(input.executionId, 'waiting');
        return {
          status: 'waiting',
          waitingNodeId: result.waitingNodeId,
        };
      }
      const finalStatus = result.status === 'success' ? 'success' : 'failed';
      await deps.updateExecutionStatus(input.executionId, finalStatus);
      return {
        status: finalStatus,
        finalOutputItems: result.finalOutputItems,
      };
    },
  };
}
