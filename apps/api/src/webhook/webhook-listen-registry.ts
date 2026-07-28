import type { DebugNodeResult } from '@rxwf/execution';
import type { WorkflowItem } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';

export type WebhookListenEvent =
  | { type: 'nodeStarted'; nodeId: string }
  | {
      type: 'nodeResult';
      nodeId: string;
      nodeResult: DebugNodeResult;
    }
  | { type: 'agentStream'; nodeId: string; chunk: unknown }
  | {
      type: 'done';
      status: 'success' | 'failed';
      failedNodeId?: string;
      executionId?: string;
    }
  | { type: 'error'; code: string; message: string };

export type WebhookListenStatus =
  | 'listening'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type WebhookListenSession = {
  listenId: string;
  workflowId: string;
  webhookNodeId: string;
  webhookPath: string;
  targetNodeId: string;
  definition: WorkflowDefinition;
  pinData: Record<string, WorkflowItem[]>;
  pinBranchData: Record<string, WorkflowItem[][]>;
  userId: string;
  startedAt: number;
  expiresAt: number;
  status: WebhookListenStatus;
  events: WebhookListenEvent[];
};

const LISTEN_TTL_MS = 5 * 60 * 1000;

const sessions = new Map<string, WebhookListenSession>();
const pathIndex = new Map<string, string>();

function pathKey(workflowId: string, webhookPath: string): string {
  return `${workflowId}:${webhookPath}`;
}

function purgeExpired(): void {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.status !== 'listening' || session.expiresAt > now) continue;
    session.status = 'expired';
    session.events.push({
      type: 'error',
      code: 'E2020',
      message: 'Webhook listen session expired',
    });
    pathIndex.delete(pathKey(session.workflowId, session.webhookPath));
  }
}

export function startWebhookListen(input: {
  workflowId: string;
  webhookNodeId: string;
  webhookPath: string;
  targetNodeId: string;
  definition: WorkflowDefinition;
  pinData?: Record<string, WorkflowItem[]>;
  pinBranchData?: Record<string, WorkflowItem[][]>;
  userId: string;
}): WebhookListenSession {
  purgeExpired();
  const existingId = pathIndex.get(pathKey(input.workflowId, input.webhookPath));
  if (existingId) {
    cancelWebhookListen(existingId);
  }

  const listenId = crypto.randomUUID();
  const now = Date.now();
  const session: WebhookListenSession = {
    listenId,
    workflowId: input.workflowId,
    webhookNodeId: input.webhookNodeId,
    webhookPath: input.webhookPath,
    targetNodeId: input.targetNodeId,
    definition: input.definition,
    pinData: input.pinData ?? {},
    pinBranchData: input.pinBranchData ?? {},
    userId: input.userId,
    startedAt: now,
    expiresAt: now + LISTEN_TTL_MS,
    status: 'listening',
    events: [],
  };
  sessions.set(listenId, session);
  pathIndex.set(pathKey(input.workflowId, input.webhookPath), listenId);
  return session;
}

export function findActiveWebhookListen(
  workflowId: string,
  webhookPath: string,
): WebhookListenSession | null {
  purgeExpired();
  const listenId = pathIndex.get(pathKey(workflowId, webhookPath));
  if (!listenId) return null;
  const session = sessions.get(listenId);
  if (!session || session.status !== 'listening') return null;
  return session;
}

export function getWebhookListenSession(
  listenId: string,
): WebhookListenSession | undefined {
  purgeExpired();
  return sessions.get(listenId);
}

export function pushWebhookListenEvent(
  listenId: string,
  event: WebhookListenEvent,
): void {
  const session = sessions.get(listenId);
  if (!session) return;
  session.events.push(event);
}

export function markWebhookListenRunning(listenId: string): void {
  const session = sessions.get(listenId);
  if (!session) return;
  session.status = 'running';
  pathIndex.delete(pathKey(session.workflowId, session.webhookPath));
}

export function finishWebhookListen(
  listenId: string,
  status: 'completed' | 'failed',
): void {
  const session = sessions.get(listenId);
  if (!session) return;
  session.status = status;
  pathIndex.delete(pathKey(session.workflowId, session.webhookPath));
}

export function cancelWebhookListen(listenId: string): boolean {
  const session = sessions.get(listenId);
  if (!session) return false;
  if (session.status !== 'listening' && session.status !== 'running') {
    return false;
  }
  session.status = 'cancelled';
  session.events.push({
    type: 'error',
    code: 'E2021',
    message: 'Webhook listen cancelled',
  });
  pathIndex.delete(pathKey(session.workflowId, session.webhookPath));
  return true;
}

export function pollWebhookListenEvents(
  listenId: string,
  fromIndex: number,
): {
  status: WebhookListenStatus;
  events: WebhookListenEvent[];
  nextIndex: number;
} | null {
  purgeExpired();
  const session = sessions.get(listenId);
  if (!session) return null;
  const events = session.events.slice(fromIndex);
  return {
    status: session.status,
    events,
    nextIndex: session.events.length,
  };
}

/** Test helper */
export function clearWebhookListenRegistry(): void {
  sessions.clear();
  pathIndex.clear();
}
