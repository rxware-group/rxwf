import { parseHitlMetadata } from './hitl-timeout.js';
import { parseGroupChatUserProxyCheckpoint } from './group-chat-user-proxy.js';

/** OQ-010 / architecture §8.3: -1 means UserProxy never times out. */
export const GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT = -1;

export const GROUP_CHAT_USER_PROXY_TIMEOUT_ERROR_CODE = 'E1048';

export const GROUP_CHAT_USER_PROXY_TIMEOUT_MESSAGE =
  'UserProxy timed out while waiting for user input';

export type GroupChatUserProxyTimeoutAction = 'fail';

export interface GroupChatUserProxyTimeoutHitlFields {
  userProxyTimeoutMs?: number;
  userProxyTimeoutAction?: GroupChatUserProxyTimeoutAction;
  requestedAt?: string;
  expiresAt?: string;
}

export interface GroupChatUserProxyTimeoutFailure {
  status: 'failed';
  errorCode: typeof GROUP_CHAT_USER_PROXY_TIMEOUT_ERROR_CODE;
  errorMessage: string;
  auditStepType: 'groupChatUserProxyTimeout';
}

export function resolveUserProxyTimeoutMs(
  config: Record<string, unknown>,
): number {
  const raw = config.userProxyTimeoutMs ?? GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) ? n : GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT;
}

export function buildUserProxyTimeoutHitlFields(
  config: Record<string, unknown>,
  requestedAtMs = Date.now(),
): GroupChatUserProxyTimeoutHitlFields {
  const timeoutMs = resolveUserProxyTimeoutMs(config);
  if (timeoutMs <= 0) return {};

  const requestedAt = new Date(requestedAtMs);
  return {
    userProxyTimeoutMs: timeoutMs,
    userProxyTimeoutAction: 'fail',
    requestedAt: requestedAt.toISOString(),
    expiresAt: new Date(requestedAt.getTime() + timeoutMs).toISOString(),
  };
}

export function isGroupChatUserProxyWaiting(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return parseGroupChatUserProxyCheckpoint(metadata) !== null;
}

export function shouldSweepGroupChatUserProxyWaiting(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!isGroupChatUserProxyWaiting(metadata)) return false;

  const hitl = parseHitlMetadata(metadata);
  if (!hitl?.expiresAt) return false;

  const timeoutMs = (hitl as { userProxyTimeoutMs?: unknown }).userProxyTimeoutMs;
  if (typeof timeoutMs === 'number') return timeoutMs > 0;

  return false;
}

export function isGroupChatUserProxyWaitingExpired(
  metadata: Record<string, unknown> | null | undefined,
  nowMs: number,
): boolean {
  if (!shouldSweepGroupChatUserProxyWaiting(metadata)) return false;

  const hitl = parseHitlMetadata(metadata);
  if (!hitl?.expiresAt) return false;

  const expiresMs = Date.parse(hitl.expiresAt);
  if (Number.isNaN(expiresMs)) return false;

  return nowMs >= expiresMs;
}

export function buildGroupChatUserProxyTimeoutFailure(): GroupChatUserProxyTimeoutFailure {
  return {
    status: 'failed',
    errorCode: GROUP_CHAT_USER_PROXY_TIMEOUT_ERROR_CODE,
    errorMessage: GROUP_CHAT_USER_PROXY_TIMEOUT_MESSAGE,
    auditStepType: 'groupChatUserProxyTimeout',
  };
}

export type GroupChatUserProxyTimeoutSweeperDeps = {
  listWaitingExecutionIds: () => Promise<string[]>;
  findWaitingNodeRun: (executionId: string) => Promise<{
    nodeId: string;
    nodeType: string;
    metadata: Record<string, unknown> | null;
  } | null>;
  failUserProxyTimeout: (input: {
    executionId: string;
    nodeId: string;
    failure: GroupChatUserProxyTimeoutFailure;
  }) => Promise<{ status: string }>;
  now?: () => number;
};

export async function runGroupChatUserProxyTimeoutSweepOnce(
  deps: GroupChatUserProxyTimeoutSweeperDeps,
): Promise<number> {
  const nowMs = deps.now?.() ?? Date.now();
  const executionIds = await deps.listWaitingExecutionIds();
  let resolved = 0;

  for (const executionId of executionIds) {
    const waitingRun = await deps.findWaitingNodeRun(executionId);
    if (!waitingRun || waitingRun.nodeType !== 'groupChat') continue;

    const metadata = waitingRun.metadata;
    if (!isGroupChatUserProxyWaitingExpired(metadata, nowMs)) continue;

    const failure = buildGroupChatUserProxyTimeoutFailure();
    const result = await deps.failUserProxyTimeout({
      executionId,
      nodeId: waitingRun.nodeId,
      failure,
    });

    if (result.status === 'failed') {
      resolved += 1;
    }
  }

  return resolved;
}
