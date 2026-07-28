import {
  collectGroupOrchestrator,
  collectSatellites,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@rxwf/workflow';
import type { AgentStepRecord, ModelRef } from '@rxwf/ai-runtime-stub';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import type { PlusExecutorDeps } from './register-plus.js';
import { buildCrewRolePrompt, modelFromChatModelNode, resolveWorkerByMemberKey } from './crew-helpers.js';

export interface GroupChatMessage {
  author: string;
  authorNodeId: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  round: number;
  at: string;
}

export interface GroupChatStepRecord {
  type: 'groupChatTurn' | 'groupChatUserProxy' | 'groupChatFinish';
  round: number;
  speaker?: string;
  content?: string;
  selectionReason?: string;
}

export interface GroupChatCheckpoint {
  transcript: GroupChatMessage[];
  round: number;
  task: string;
  finalAnswer?: string;
  memberIds: string[];
}

export type GroupOrchestratorDecision =
  | { action: 'speak'; member: string; reason?: string }
  | { action: 'finish'; answer: string }
  | { action: 'request_user' };

export function buildGroupChatTurnStep(params: {
  round: number;
  speaker: string;
  content: string;
  selectionReason?: string;
}): GroupChatStepRecord {
  return {
    type: 'groupChatTurn',
    round: params.round,
    speaker: params.speaker,
    content: params.content,
    selectionReason: params.selectionReason,
  };
}

export function buildGroupChatUserProxyStep(
  round: number,
  prompt?: string,
): GroupChatStepRecord {
  return {
    type: 'groupChatUserProxy',
    round,
    content: prompt,
  };
}

export function buildGroupChatFinishStep(
  round: number,
  content: string,
  selectionReason?: string,
): GroupChatStepRecord {
  return {
    type: 'groupChatFinish',
    round,
    content,
    selectionReason,
  };
}

export function toGroupChatAgentStepRecords(
  steps: GroupChatStepRecord[],
): AgentStepRecord[] {
  return steps.map((step) => ({
    type: 'agent_step',
    status: 'success',
    output: step,
  }));
}

export interface GroupChatAuditValidationOptions {
  /** Rounds where user proxy pause was triggered — each must have groupChatUserProxy step */
  userProxyRounds?: number[];
}

export function validateGroupChatAgentSteps(
  steps: GroupChatStepRecord[],
  options: GroupChatAuditValidationOptions = {},
): void {
  const { userProxyRounds = [] } = options;
  for (const round of userProxyRounds) {
    const hasProxy = steps.some(
      (s) => s.type === 'groupChatUserProxy' && s.round === round,
    );
    if (!hasProxy) {
      throw new AwfError(
        'E1047',
        `Missing groupChatUserProxy audit step for round ${round}`,
      );
    }
  }
}

export function configFlag(value: unknown, defaultTrue = true): boolean {
  if (value === undefined || value === null) return defaultTrue;
  return String(value).toLowerCase() !== 'false';
}

export function buildGroupChatTask(
  config: Record<string, unknown>,
  inputItems: WorkflowItem[],
): string {
  const taskRaw = String(config.task ?? '').trim();
  if (taskRaw) return taskRaw;
  if (inputItems.length === 0) return 'Discuss and resolve the task as a group.';
  return JSON.stringify(inputItems.map((i) => i.json));
}

export function selectRoundRobinSpeaker(memberNames: string[], round: number): string {
  if (memberNames.length === 0) return '';
  const index = (Math.max(1, round) - 1) % memberNames.length;
  return memberNames[index]!;
}

export function selectRoundRobinMember(
  members: WorkflowNode[],
  round: number,
): WorkflowNode {
  const index = (Math.max(1, round) - 1) % members.length;
  return members[index] ?? members[0]!;
}

export function shouldTerminateByKeywords(
  content: string,
  keywordsCsv: string,
): boolean {
  const keywords = keywordsCsv
    .split(/[,;\s]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return false;
  const lower = content.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export function appendTranscriptMessage(
  transcript: GroupChatMessage[],
  message: Omit<GroupChatMessage, 'at'> & { at?: string },
): GroupChatMessage {
  const entry: GroupChatMessage = {
    ...message,
    at: message.at ?? new Date().toISOString(),
  };
  transcript.push(entry);
  return entry;
}

export function buildGroupChatRolePrompt(params: Record<string, unknown>): string {
  const base = buildCrewRolePrompt(params, 'sequential');
  return [base, 'You are in a group chat. Respond to the shared conversation; be concise.']
    .filter((s) => s.trim())
    .join('\n\n');
}

export function shouldPauseForUserProxy(
  round: number,
  config: Record<string, unknown>,
  skipThisRound: boolean,
): boolean {
  if (skipThisRound) return false;
  if (!configFlag(config.userProxyEnabled, false)) return false;
  const every = Number(config.userProxyEveryNRounds ?? 0);
  if (every <= 0) return false;
  return round > 1 && round % every === 0;
}

export function parseGroupOrchestratorDecision(raw: string): GroupOrchestratorDecision | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = parsed.action;
    if (action === 'finish') {
      return { action: 'finish', answer: String(parsed.answer ?? '').trim() };
    }
    if (action === 'request_user') {
      return { action: 'request_user' };
    }
    if (action === 'speak') {
      const member = String(parsed.member ?? '').trim();
      if (!member) return null;
      return {
        action: 'speak',
        member,
        reason: String(parsed.reason ?? '').trim() || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveGroupOrchestratorModel(
  definition: WorkflowDefinition,
  groupChatNodeId: string,
  config: Record<string, unknown>,
): ModelRef {
  const orchestratorAgent = collectGroupOrchestrator(definition, groupChatNodeId);
  if (orchestratorAgent) {
    const satellites = collectSatellites(definition, orchestratorAgent.id);
    if (satellites.model) {
      return modelFromChatModelNode(satellites.model.parameters);
    }
  }
  const model = String(config.orchestratorModel ?? '').trim();
  if (model) {
    const credentialId = String(config.orchestratorCredentialId ?? '').trim();
    return {
      provider: String(config.orchestratorProvider ?? 'ollama'),
      model,
      baseUrl: config.orchestratorBaseUrl
        ? String(config.orchestratorBaseUrl)
        : undefined,
      credentialId: credentialId || undefined,
    };
  }
  throw new AwfError(
    'E1049',
    'groupChat orchestrator mode requires group_orchestrator Agent with Chat Model or orchestratorModel',
  );
}

export async function askGroupOrchestrator(
  deps: PlusExecutorDeps,
  model: ModelRef,
  members: WorkflowNode[],
  task: string,
  transcript: GroupChatMessage[],
  round: number,
  maxRounds: number,
): Promise<GroupOrchestratorDecision> {
  if (!deps.ai) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }

  const roster = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: String(m.parameters.role ?? m.name),
  }));

  const system = `You are a group chat ORCHESTRATOR. Pick who speaks next or finish the discussion.
Respond with ONLY one JSON object (no markdown).

Next speaker:
{"action":"speak","member":"<id, name, or role>","reason":"<optional>"}

Request human input (UserProxy):
{"action":"request_user"}

When done:
{"action":"finish","answer":"<final consolidated answer>"}

Roster:
${JSON.stringify(roster, null, 2)}

Task:
${task}

Transcript:
${JSON.stringify(transcript, null, 2)}

Current round: ${round} / ${maxRounds}`;

  const user = `Choose the next group chat action for round ${round}.`;

  let text = '';
  for await (const chunk of deps.ai.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model },
  )) {
    text += chunk;
  }

  const decision = parseGroupOrchestratorDecision(text);
  if (!decision) {
    throw new AwfError(
      'E1049',
      `Group chat orchestrator returned invalid JSON: ${text.slice(0, 200)}`,
    );
  }
  return decision;
}

export function resolveGroupSpeaker(
  members: WorkflowNode[],
  memberKey: string,
): WorkflowNode | null {
  return resolveWorkerByMemberKey(members, memberKey);
}
