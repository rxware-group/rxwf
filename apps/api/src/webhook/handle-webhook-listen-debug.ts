import { verifyWebhookAuth, type WebhookAuthConfig } from '@rxwf/execution';
import type { WorkflowItem } from '@rxwf/shared';
import type { ExecutionRuntime } from '../execution/create-execution-runtime.js';
import {
  findActiveWebhookListen,
  finishWebhookListen,
  markWebhookListenRunning,
  pushWebhookListenEvent,
  type WebhookListenSession,
} from './webhook-listen-registry.js';

export type WebhookListenDebugResult =
  | {
      handled: true;
      status: number;
      body: {
        executionId?: string;
        status: string;
        listenId: string;
        code?: string;
      };
    }
  | { handled: false };

const WEBHOOK_TIMESTAMP_SKEW_MS = 300_000;

function webhookAuthErrorMessage(code: 'E2005' | 'E2006' | 'E2014'): string {
  switch (code) {
    case 'E2005':
      return 'Webhook signature verification failed';
    case 'E2006':
      return 'Webhook timestamp is invalid or expired';
    case 'E2014':
      return 'Webhook API Key is missing or invalid';
  }
}

export async function tryHandleWebhookListenDebug(
  runtime: ExecutionRuntime,
  input: {
    workflowId: string;
    webhookPath: string;
    inputItems: WorkflowItem[];
    auth: WebhookAuthConfig;
    body: Buffer;
    signature: string;
    apiKeyHeader: string;
    timestamp: string;
  },
): Promise<WebhookListenDebugResult> {
  const session = findActiveWebhookListen(input.workflowId, input.webhookPath);
  if (!session) {
    return { handled: false };
  }

  const authResult = verifyWebhookAuth({
    config: input.auth,
    apiKeyHeader: input.apiKeyHeader,
    signature: input.signature,
    timestamp: input.timestamp,
    body: input.body,
    nowMs: Date.now(),
    maxTimestampSkewMs: WEBHOOK_TIMESTAMP_SKEW_MS,
  });
  if (!authResult.ok) {
    pushWebhookListenEvent(session.listenId, {
      type: 'error',
      code: authResult.code,
      message: webhookAuthErrorMessage(authResult.code),
    });
    finishWebhookListen(session.listenId, 'failed');
    return {
      handled: true,
      status: authResult.status,
      body: {
        code: authResult.code,
        listenId: session.listenId,
        status: 'failed',
      },
    };
  }

  markWebhookListenRunning(session.listenId);
  await runListenDebug(runtime, session, input.inputItems);
  return {
    handled: true,
    status: 202,
    body: {
      listenId: session.listenId,
      status: 'accepted',
    },
  };
}

async function runListenDebug(
  runtime: ExecutionRuntime,
  session: WebhookListenSession,
  inputItems: WorkflowItem[],
): Promise<void> {
  const { listenId, webhookNodeId, targetNodeId } = session;
  try {
    const result = await runtime.debugNode({
      definition: session.definition,
      targetNodeId,
      pinData: session.pinData,
      pinBranchData: session.pinBranchData,
      workflowId: session.workflowId,
      environment: 'test',
      triggerInputs: { [webhookNodeId]: inputItems },
      onNodeStarted: (nodeId) => {
        pushWebhookListenEvent(listenId, { type: 'nodeStarted', nodeId });
      },
      onNodeResult: (nodeId, nodeResult) => {
        pushWebhookListenEvent(listenId, { type: 'nodeResult', nodeId, nodeResult });
      },
      onAgentStream: (nodeId, chunk) => {
        pushWebhookListenEvent(listenId, { type: 'agentStream', nodeId, chunk });
      },
    });
    pushWebhookListenEvent(listenId, {
      type: 'done',
      status: result.status,
      failedNodeId: result.failedNodeId,
      executionId: result.executionId,
    });
    finishWebhookListen(listenId, result.status === 'success' ? 'completed' : 'failed');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook listen debug failed';
    pushWebhookListenEvent(listenId, {
      type: 'error',
      code: 'E2000',
      message,
    });
    finishWebhookListen(listenId, 'failed');
  }
}
