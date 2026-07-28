export interface ErrorFailureInput {
  executionId: string;
  workflowId: string;
  errorWorkflowId: string;
  failedNode: string;
  errorMessage: string;
  stack?: string;
  currentDepth: number;
}

export interface ErrorEnqueueJob {
  workflowId: string;
  triggerType: 'error';
  payload: Record<string, unknown>;
  errorDepth: number;
}

export function createErrorWorkflowService(deps: {
  enqueue: (job: ErrorEnqueueJob) => Promise<void>;
  maxErrorDepth: number;
}) {
  return {
    async handleFailure(input: ErrorFailureInput): Promise<void> {
      if (input.currentDepth >= deps.maxErrorDepth) {
        return;
      }
      if (!input.errorWorkflowId) {
        return;
      }
      await deps.enqueue({
        workflowId: input.errorWorkflowId,
        triggerType: 'error',
        errorDepth: input.currentDepth + 1,
        payload: {
          executionId: input.executionId,
          workflowId: input.workflowId,
          failedNode: input.failedNode,
          errorMessage: input.errorMessage,
          stack: input.stack,
          timestamp: new Date().toISOString(),
        },
      });
    },
  };
}
