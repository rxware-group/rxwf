import type { ParamField } from './node-param-schemas.js';

/** Keep in sync with `packages/workflow/src/validate-group-chat.ts` defaults. */
export const GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT = -1;

const GROUP_EXECUTION_BACKEND: ParamField = {
  key: 'executionBackend',
  label: '执行后端',
  type: 'select',
  options: ['native', 'langgraph'],
  default: 'native',
  optionLabelKeys: {
    native: 'editor.groupChatBackend.native',
    langgraph: 'editor.groupChatBackend.langgraph',
  },
};

export const GROUP_CHAT_PARAM_FIELDS: ParamField[] = [
  GROUP_EXECUTION_BACKEND,
  { key: 'maxRounds', label: '最大发言轮次', type: 'number', default: '8' },
  {
    key: 'speakerSelection',
    label: '发言策略',
    type: 'select',
    options: ['roundRobin', 'orchestrator'],
    default: 'roundRobin',
  },
  {
    key: 'terminationKeywords',
    label: '终止关键词（逗号分隔）',
    type: 'text',
    placeholder: 'TERMINATE,FINISH,完成',
    default: 'TERMINATE,FINISH,完成',
  },
  {
    key: 'returnTranscript',
    label: '输出完整 transcript',
    type: 'select',
    options: ['true', 'false'],
    default: 'true',
  },
  {
    key: 'returnTranscriptMarkdown',
    label: '输出 Markdown transcript',
    type: 'select',
    options: ['true', 'false'],
    default: 'false',
  },
  {
    key: 'userProxyEnabled',
    label: '启用 UserProxy',
    type: 'select',
    options: ['true', 'false'],
    default: 'false',
  },
  {
    key: 'userProxyPrompt',
    label: 'UserProxy 提示语',
    type: 'text',
    default: '请输入纠偏或补充…',
  },
  {
    key: 'userProxyEveryNRounds',
    label: '每 N 轮暂停（0=仅 orchestrator 请求）',
    type: 'number',
    default: '0',
  },
  {
    key: 'userProxyTimeoutMs',
    label: 'UserProxy 超时 (ms)',
    type: 'number',
    placeholder: '-1 表示不超时',
    default: String(GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT),
    settingsTab: true,
  },
  {
    key: 'userProxyTimeoutAction',
    label: 'UserProxy 超时动作',
    type: 'select',
    options: ['fail'],
    default: 'fail',
    settingsTab: true,
  },
  {
    key: 'orchestratorProvider',
    label: 'Orchestrator 模型',
    type: 'select',
    options: ['ollama', 'openai-compatible'],
    default: 'ollama',
  },
  { key: 'orchestratorModel', label: 'Orchestrator Model', type: 'text', default: 'llama3' },
  { key: 'orchestratorBaseUrl', label: 'Orchestrator Base URL', type: 'text', default: '' },
  { key: 'orchestratorCredentialId', label: 'Orchestrator Credential', type: 'text', default: '' },
];

export function getGroupChatDefaultParameters(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of GROUP_CHAT_PARAM_FIELDS) {
    if (field.default === undefined) continue;
    if (field.type === 'number') {
      out[field.key] = Number(field.default);
      continue;
    }
    if (field.type === 'select' && (field.options ?? []).includes('true')) {
      out[field.key] = field.default === 'true';
      continue;
    }
    out[field.key] = field.default;
  }
  return out;
}

export function getGroupChatParamSchema(): ParamField[] {
  return GROUP_CHAT_PARAM_FIELDS;
}

export function getGroupChatBasicParamSchema(): ParamField[] {
  return GROUP_CHAT_PARAM_FIELDS.filter((f) => !f.settingsTab);
}

export function getGroupChatSettingsParamSchema(): ParamField[] {
  return GROUP_CHAT_PARAM_FIELDS.filter((f) => f.settingsTab);
}

/** Panel-side guard: userProxyTimeoutMs field default must stay -1 (OQ-010). */
export function validateGroupChatPanelDefaults(): string[] {
  const issues: string[] = [];
  const timeoutField = GROUP_CHAT_PARAM_FIELDS.find((f) => f.key === 'userProxyTimeoutMs');
  if (Number(timeoutField?.default) !== GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT) {
    issues.push('userProxyTimeoutMs panel default must be -1');
  }
  const workflowDefaults = getGroupChatDefaultParameters();
  if (workflowDefaults.userProxyTimeoutMs !== GROUP_CHAT_USER_PROXY_TIMEOUT_MS_DEFAULT) {
    issues.push('userProxyTimeoutMs workflow default must be -1');
  }
  return issues;
}
