import { api } from '../../api/client.js';
import type { WorkflowDefinition } from '../../api/client.js';

export type WebhookListenPollHandlers = {
  onListenStarted?: (listenId: string) => void;
  onListenError?: (error: { code?: string; message: string }) => void;
  onNodeStarted?: (nodeId: string) => void;
  onNodeResult?: (
    nodeId: string,
    nodeResult: {
      status: 'success' | 'failed' | 'skipped' | 'waiting';
      itemCount: number;
      durationMs?: number;
      errorMessage?: string;
      errorCode?: string;
      outputItems?: { json: Record<string, unknown> }[][];
      logs?: Array<{
        level: 'info' | 'warn' | 'error';
        message: string;
        timestamp: string;
      }>;
      agentStream?: Array<{ type: string; tool?: string; content?: string }>;
    },
  ) => void;
  onAgentStream?: (nodeId: string, chunk: unknown) => void;
  isCancelled?: () => boolean;
};

const TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled',
  'expired',
  'failed',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWebhookListenDebug(input: {
  workflowId: string;
  webhookNodeId: string;
  targetNodeId: string;
  webhookPath: string;
  definition: WorkflowDefinition;
  pinData?: Record<string, { json: Record<string, unknown> }[]>;
  pinBranchData?: Record<string, { json: Record<string, unknown> }[][]>;
  handlers: WebhookListenPollHandlers;
}): Promise<{
  status: 'success' | 'failed' | 'cancelled' | 'expired';
  failedNodeId?: string;
  executionId?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  const started = await api.workflows.startWebhookListen(input.workflowId, {
    webhookNodeId: input.webhookNodeId,
    targetNodeId: input.targetNodeId,
    webhookPath: input.webhookPath,
    definition: input.definition,
    pinData: input.pinData,
    pinBranchData: input.pinBranchData,
  });
  input.handlers.onListenStarted?.(started.listenId);

  let eventIndex = 0;
  let doneResult:
    | { status: 'success' | 'failed'; failedNodeId?: string; executionId?: string }
    | undefined;
  let errorMessage: string | undefined;
  let errorCode: string | undefined;

  while (!input.handlers.isCancelled?.()) {
    const polled = await api.workflows.pollWebhookListenEvents(
      input.workflowId,
      started.listenId,
      eventIndex,
    );
    eventIndex = polled.nextIndex;

    for (const event of polled.events) {
      if (event.type === 'nodeStarted') {
        input.handlers.onNodeStarted?.(event.nodeId);
      } else if (event.type === 'nodeResult') {
        input.handlers.onNodeResult?.(event.nodeId, event.nodeResult);
      } else if (event.type === 'agentStream') {
        input.handlers.onAgentStream?.(event.nodeId, event.chunk);
      } else if (event.type === 'done') {
        doneResult = {
          status: event.status,
          failedNodeId: event.failedNodeId,
          executionId: event.executionId,
        };
      } else if (event.type === 'error') {
        errorMessage = event.message;
        errorCode = event.code;
        input.handlers.onListenError?.({ code: event.code, message: event.message });
      }
    }

    if (TERMINAL_STATUSES.has(polled.status)) {
      if (polled.status === 'cancelled') {
        return { status: 'cancelled' };
      }
      if (polled.status === 'expired') {
        return { status: 'expired', errorCode, errorMessage: errorMessage ?? 'Listen session expired' };
      }
      if (doneResult) {
        return {
          status: doneResult.status,
          failedNodeId: doneResult.failedNodeId,
          executionId: doneResult.executionId,
          errorCode,
          errorMessage,
        };
      }
      return {
        status: polled.status === 'completed' ? 'success' : 'failed',
        errorCode,
        errorMessage,
      };
    }

    if (Date.now() > started.expiresAt) {
      return { status: 'expired', errorCode, errorMessage: errorMessage ?? 'Listen session expired' };
    }

    await sleep(400);
  }

  await api.workflows.cancelWebhookListen(input.workflowId, started.listenId);
  return { status: 'cancelled' };
}

export async function cancelActiveWebhookListen(
  workflowId: string,
  listenId: string,
): Promise<void> {
  await api.workflows.cancelWebhookListen(workflowId, listenId);
}
