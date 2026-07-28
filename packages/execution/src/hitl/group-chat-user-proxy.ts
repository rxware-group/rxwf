import { AwfError } from '@rxwf/shared';

export interface GroupChatMessage {
  author: string;
  authorNodeId: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  round: number;
  at: string;
}

export interface GroupChatCheckpoint {
  transcript: GroupChatMessage[];
  round: number;
  task: string;
  memberIds: string[];
  finalAnswer?: string;
}

export interface GroupChatOrchestrationResume {
  kind: 'groupChat';
  checkpoint: GroupChatCheckpoint;
  userMessage: string;
}

export interface GroupChatUserProxyWaitingMetadata {
  hitl: {
    prompt: string;
    allowReject: false;
    allowSupplement: true;
  };
  groupChat: {
    checkpoint: GroupChatCheckpoint;
  };
}

const DEFAULT_USER_PROXY_PROMPT = '请输入纠偏或补充…';

export function parseGroupChatUserProxyCheckpoint(
  metadata: Record<string, unknown> | null | undefined,
): GroupChatCheckpoint | null {
  const gc = metadata?.groupChat;
  if (!gc || typeof gc !== 'object') return null;
  const cp = (gc as { checkpoint?: unknown }).checkpoint;
  if (!cp || typeof cp !== 'object') return null;
  const c = cp as Partial<GroupChatCheckpoint>;
  if (
    !Array.isArray(c.transcript) ||
    typeof c.round !== 'number' ||
    typeof c.task !== 'string' ||
    !Array.isArray(c.memberIds)
  ) {
    return null;
  }
  return {
    transcript: c.transcript as GroupChatMessage[],
    round: c.round,
    task: c.task,
    memberIds: c.memberIds as string[],
    finalAnswer: typeof c.finalAnswer === 'string' ? c.finalAnswer : undefined,
  };
}

export function buildGroupChatUserProxyWaitingMetadata(
  config: Record<string, unknown>,
  checkpoint: GroupChatCheckpoint,
): GroupChatUserProxyWaitingMetadata {
  const prompt = String(config.userProxyPrompt ?? DEFAULT_USER_PROXY_PROMPT);
  return {
    hitl: {
      prompt,
      allowReject: false,
      allowSupplement: true,
    },
    groupChat: { checkpoint },
  };
}

export function validateGroupChatUserProxyResume(input: {
  decision: 'approve' | 'reject';
  supplement?: string;
}): void {
  if (input.decision === 'reject') return;
  const message = input.supplement?.trim() ?? '';
  if (!message) {
    throw new AwfError(
      'E3014',
      'UserProxy resume requires a non-empty supplement to append user message',
    );
  }
}

export function appendUserProxyMessage(
  checkpoint: GroupChatCheckpoint,
  userMessage: string,
): GroupChatCheckpoint {
  const content = userMessage.trim();
  const transcript = [...checkpoint.transcript];
  transcript.push({
    author: 'User',
    authorNodeId: 'user',
    role: 'user',
    content,
    round: checkpoint.round,
    at: new Date().toISOString(),
  });
  return { ...checkpoint, transcript };
}

export function buildGroupChatUserProxyOrchestrationResume(
  checkpoint: GroupChatCheckpoint,
  input: { decision: 'approve' | 'reject'; supplement?: string },
): GroupChatOrchestrationResume {
  validateGroupChatUserProxyResume(input);
  const userMessage = input.supplement!.trim();
  return {
    kind: 'groupChat',
    checkpoint,
    userMessage,
  };
}

export function applyGroupChatUserProxyResumeToCheckpoint(
  checkpoint: GroupChatCheckpoint,
  userMessage: string,
): GroupChatCheckpoint {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new AwfError(
      'E3014',
      'UserProxy resume requires a non-empty supplement to append user message',
    );
  }
  return appendUserProxyMessage(checkpoint, trimmed);
}

export function assertUserMessageAppendedOnResume(
  before: GroupChatCheckpoint,
  after: GroupChatCheckpoint,
  expectedContent: string,
): void {
  const expected = expectedContent.trim();
  if (!expected) {
    throw new AwfError(
      'E3014',
      'UserProxy resume verification requires non-empty user message',
    );
  }
  if (after.transcript.length <= before.transcript.length) {
    throw new AwfError(
      'E3014',
      'UserProxy resume did not append user message to transcript',
    );
  }
  const appended = after.transcript.slice(before.transcript.length);
  const hasUser = appended.some(
    (m) => m.role === 'user' && m.content.includes(expected),
  );
  if (!hasUser) {
    throw new AwfError(
      'E3014',
      'UserProxy resume did not append user message to transcript',
    );
  }
}
