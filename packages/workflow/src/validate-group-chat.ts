import { collectSatellites } from './agent-satellites.js';
import {
  collectGroupMembers,
  collectGroupOrchestrator,
} from './group-members.js';
import type { ValidationError, WorkflowDefinition, WorkflowNode } from './validate.js';

/** OQ-010 / architecture §8.3: -1 means UserProxy never times out. */
export const GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT = -1;

export type GroupChatSpeakerSelection = 'roundRobin' | 'orchestrator';
export type GroupChatUserProxyTimeoutAction = 'fail';
export type GroupChatExecutionBackend = 'native' | 'langgraph';

const SPEAKER_SELECTIONS = new Set<GroupChatSpeakerSelection>([
  'roundRobin',
  'orchestrator',
]);
const EXECUTION_BACKENDS = new Set<GroupChatExecutionBackend>(['native', 'langgraph']);
const USER_PROXY_TIMEOUT_ACTIONS = new Set<GroupChatUserProxyTimeoutAction>(['fail']);

export function defaultGroupChatParameters(): Record<string, unknown> {
  return {
    maxRounds: 8,
    executionBackend: 'native',
    speakerSelection: 'roundRobin',
    terminationKeywords: 'TERMINATE,FINISH,完成',
    returnTranscript: true,
    returnTranscriptMarkdown: false,
    userProxyEnabled: false,
    userProxyPrompt: '请输入纠偏或补充…',
    userProxyEveryNRounds: 0,
    userProxyTimeoutMs: GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT,
    userProxyTimeoutAction: 'fail',
    orchestratorProvider: 'ollama',
    orchestratorModel: 'llama3',
    orchestratorBaseUrl: '',
    orchestratorCredentialId: '',
  };
}

export function normalizeGroupChatParameters(
  parameters?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaultGroupChatParameters(), ...(parameters ?? {}) };
}

function configFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function parseBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.trunc(n);
  return Math.max(min, Math.min(max, rounded));
}

export function validateGroupChatNodeParameters(
  node: WorkflowNode,
  errors: ValidationError[],
): void {
  if (node.type !== 'groupChat') return;

  const defaults = defaultGroupChatParameters();
  const p = normalizeGroupChatParameters(node.parameters);

  const maxRounds = parseBoundedInt(p.maxRounds, Number(defaults.maxRounds), 1, 50);
  if (Number(p.maxRounds) !== maxRounds && p.maxRounds !== undefined && p.maxRounds !== '') {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: maxRounds must be an integer between 1 and 50`,
      nodeId: node.id,
    });
  }

  const speakerSelection = String(p.speakerSelection ?? defaults.speakerSelection);
  if (!SPEAKER_SELECTIONS.has(speakerSelection as GroupChatSpeakerSelection)) {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: invalid speakerSelection "${speakerSelection}"`,
      nodeId: node.id,
    });
  }

  const executionBackend = String(p.executionBackend ?? defaults.executionBackend);
  if (!EXECUTION_BACKENDS.has(executionBackend as GroupChatExecutionBackend)) {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: invalid executionBackend "${executionBackend}"`,
      nodeId: node.id,
    });
  }

  const userProxyEveryNRounds = parseBoundedInt(
    p.userProxyEveryNRounds,
    Number(defaults.userProxyEveryNRounds),
    0,
    50,
  );
  if (
    Number(p.userProxyEveryNRounds) !== userProxyEveryNRounds &&
    p.userProxyEveryNRounds !== undefined &&
    p.userProxyEveryNRounds !== ''
  ) {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: userProxyEveryNRounds must be an integer between 0 and 50`,
      nodeId: node.id,
    });
  }

  const timeoutRaw = p.userProxyTimeoutMs;
  if (timeoutRaw !== undefined && timeoutRaw !== null && timeoutRaw !== '') {
    const timeout = Number(timeoutRaw);
    if (!Number.isFinite(timeout) || !Number.isInteger(timeout) || timeout < -1) {
      errors.push({
        code: 'E1053',
        message: `Node ${node.name}: userProxyTimeoutMs must be -1 (no timeout) or a non-negative integer`,
        nodeId: node.id,
      });
    }
  }

  const timeoutAction = String(p.userProxyTimeoutAction ?? defaults.userProxyTimeoutAction);
  if (!USER_PROXY_TIMEOUT_ACTIONS.has(timeoutAction as GroupChatUserProxyTimeoutAction)) {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: invalid userProxyTimeoutAction "${timeoutAction}"`,
      nodeId: node.id,
    });
  }

  if (configFlag(p.userProxyEnabled, false) && timeoutAction !== 'fail') {
    errors.push({
      code: 'E1053',
      message: `Node ${node.name}: userProxyTimeoutAction must be "fail" when UserProxy is enabled`,
      nodeId: node.id,
    });
  }
}

export function validateGroupChatNodes(
  definition: WorkflowDefinition,
  errors: ValidationError[],
  warnings: ValidationError[] = [],
): void {
  for (const node of definition.nodes) {
    if (node.type !== 'groupChat') continue;

    validateGroupChatNodeParameters(node, errors);

    const members = collectGroupMembers(definition, node.id);
    if (members.length < 2) {
      errors.push({
        code: 'E1048',
        message: 'Group Chat requires at least two connected aiAgent members on group_member',
        nodeId: node.id,
      });
    }

    for (const member of members) {
      const satellites = collectSatellites(definition, member.id);
      if (!satellites.model) {
        errors.push({
          code: 'E1012',
          message: `Group Chat member ${member.name} requires a connected Chat Model`,
          nodeId: member.id,
        });
      }
      if (!String(member.parameters.role ?? '').trim()) {
        warnings.push({
          code: 'W1012',
          message: `Group Chat member ${member.name} has no role configured`,
          nodeId: member.id,
        });
      }
    }

    const p = normalizeGroupChatParameters(node.parameters);
    if (String(p.speakerSelection) === 'orchestrator') {
      const orchestratorAgent = collectGroupOrchestrator(definition, node.id);
      const hasInlineModel = Boolean(String(p.orchestratorModel ?? '').trim());
      const orchestratorHasModel =
        orchestratorAgent &&
        definition.connections.some(
          (c) =>
            c.to === orchestratorAgent.id &&
            (c.toInput ?? 'main') === 'ai_languageModel',
        );
      if (!hasInlineModel && !orchestratorHasModel) {
        errors.push({
          code: 'E1049',
          message:
            'Group Chat orchestrator mode requires orchestratorModel or group_orchestrator Agent with Chat Model',
          nodeId: node.id,
        });
      }
    }
  }
}
