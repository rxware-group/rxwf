export type ParamFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'textarea'
  | 'javascript'
  | 'json'
  | 'expression';

export interface ParamField {
  key: string;
  label: string;
  type: ParamFieldType;
  options?: string[];
  placeholder?: string;
  /** 渲染在节点编辑器「设置」Tab（如 timeoutMs） */
  settingsTab?: boolean;
  /** 不显示固定/表达式切换（如 Code 节点的 JavaScript 源码） */
  plainText?: boolean;
  /** Tool 节点：允许 $fromAI 模式 */
  allowFromAi?: boolean;
  default?: string;
  optionLabelKeys?: Record<string, string>;
}

const GROUP_EXECUTION_BACKEND: ParamField = {
  key: 'executionBackend',
  label: '执行后端',
  type: 'select',
  options: ['native', 'langgraph'],
  default: 'native',
  optionLabelKeys: {
    native: 'editor.crewBackend.native',
    langgraph: 'editor.groupChatBackend.langgraph',
  },
};

const CREW_EXECUTION_BACKEND: ParamField = {
  key: 'executionBackend',
  label: '执行后端',
  type: 'select',
  options: ['native', 'crewai'],
  default: 'native',
  optionLabelKeys: {
    native: 'editor.crewBackend.native',
    crewai: 'editor.crewBackend.crewai',
  },
};

const CREW_BUILTIN_TOOLS: ParamField = {
  key: 'enableBuiltinTools',
  label: 'CrewAI 内置 Tool',
  type: 'json',
  placeholder: '["SerperDevTool"]',
};

const CREW_FLOW_MODE: ParamField = {
  key: 'crewaiFlowMode',
  label: 'CrewAI 编排模式',
  type: 'select',
  options: ['crew', 'flow'],
  default: 'crew',
  optionLabelKeys: {
    crew: 'editor.crewFlowMode.crew',
    flow: 'editor.crewFlowMode.flow',
  },
};

const CREW_ENABLE_EVAL: ParamField = {
  key: 'enableEval',
  label: '启用 CrewAI 评测',
  type: 'select',
  options: ['false', 'true'],
  default: 'false',
};

const CREW_KNOWLEDGE_MODE: ParamField = {
  key: 'crewaiKnowledgeMode',
  label: 'Knowledge 注入模式',
  type: 'select',
  options: ['inject', 'native'],
  default: 'inject',
  optionLabelKeys: {
    inject: 'editor.crewKnowledgeMode.inject',
    native: 'editor.crewKnowledgeMode.native',
  },
};

const CREW_FLOW_ROUTER: ParamField = {
  key: 'flowRouter',
  label: 'Flow Router (JSON)',
  type: 'json',
  placeholder:
    '{"afterMemberNodeId":"r1","defaultMemberNodeId":"r2","branches":[{"condition":"contains:review","memberNodeId":"r2"}]}',
};

const SCHEMAS: Record<string, ParamField[]> = {
  stickyNote: [
    {
      key: 'content',
      label: 'Markdown 内容',
      type: 'textarea',
      placeholder: '# 标题\n说明文字…',
    },
  ],
  webhookTrigger: [],
  manualTrigger: [
    {
      key: 'json',
      label: 'JSON',
      type: 'json',
      placeholder: '{\n  "key": "value"\n}',
    },
  ],
  errorTrigger: [
    {
      key: '_debugSamplePayload',
      label: '调试样例载荷 (JSON)',
      type: 'json',
      placeholder:
        '{"executionId":"ex-1","workflowId":"wf-1","failedNode":"HTTP","errorMessage":"boom","timestamp":"2026-05-20T00:00:00Z"}',
    },
  ],
  httpRequest: [
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    {
      key: 'url',
      label: 'URL',
      type: 'text',
      placeholder: 'https://api.example.com 或 {{ $env.API_URL }}/path',
    },
    {
      key: 'responseBinaryMode',
      label: 'Response Binary',
      type: 'select',
      options: ['off', 'auto', 'always'],
      optionLabelKeys: {
        off: 'editor.http.responseBinaryMode.off',
        auto: 'editor.http.responseBinaryMode.auto',
        always: 'editor.http.responseBinaryMode.always',
      },
      settingsTab: true,
    },
    {
      key: 'responseBinaryPropertyName',
      label: 'Response binary property',
      type: 'text',
      placeholder: 'data',
      settingsTab: true,
    },
    {
      key: 'binaryBodyPropertyName',
      label: 'Binary body property',
      type: 'text',
      placeholder: 'data',
      settingsTab: true,
    },
  ],
  if: [
    {
      key: 'condition',
      label: '条件',
      type: 'expression',
      placeholder: '{{ $json.orderId === "1001" && $env.STAGE === "prod" }}',
    },
  ],
  switch: [],
  loop: [{ key: 'batchSize', label: '每批 Items 数', type: 'number' }],
  merge: [
    { key: 'inputCount', label: '输入数量', type: 'number' },
    {
      key: 'mode',
      label: '合并模式',
      type: 'select',
      options: ['append', 'combineByKey', 'combineAll'],
      optionLabelKeys: {
        append: 'editor.mergeMode.append',
        combineByKey: 'editor.mergeMode.combineByKey',
        combineAll: 'editor.mergeMode.combineAll',
      },
    },
    {
      key: 'matchField',
      label: '匹配字段 (combineByKey)',
      type: 'text',
      placeholder: 'id',
    },
  ],
  code: [
    {
      key: 'jsCode',
      label: 'JavaScript',
      type: 'javascript',
      plainText: true,
      placeholder: 'return $input.map((item) => ({ json: item.json }));',
    },
    {
      key: 'timeoutMs',
      label: '超时 (ms)',
      type: 'number',
      placeholder: '-1 表示不超时',
      default: '-1',
      settingsTab: true,
    },
  ],
  executeCommand: [
    {
      key: 'timeoutMs',
      label: '超时 (ms)',
      type: 'number',
      placeholder: '0 表示不超时，-1 或留空默认 120 秒',
      default: '-1',
      settingsTab: true,
    },
  ],
  wait: [{ key: 'ms', label: '等待 (ms)', type: 'number' }],
  humanApproval: [
    { key: 'prompt', label: '审批提示', type: 'textarea', placeholder: '请确认是否继续部署 {{ $json.version }}' },
    { key: 'summaryField', label: '摘要字段（表达式）', type: 'expression', placeholder: '{{ $json }}' },
    {
      key: 'allowReject',
      label: '允许驳回',
      type: 'select',
      options: ['true', 'false'],
      default: 'true',
    },
    {
      key: 'allowSupplement',
      label: '允许补充输入',
      type: 'select',
      options: ['true', 'false'],
      default: 'false',
    },
    { key: 'timeoutMs', label: '超时 (ms，0=无)', type: 'number', settingsTab: true },
    {
      key: 'timeoutAction',
      label: '超时策略',
      type: 'select',
      options: ['reject', 'approve'],
      default: 'reject',
      settingsTab: true,
    },
  ],
  set: [
    { key: 'mode', label: '模式', type: 'select', options: ['manual', 'expression'] },
    {
      key: 'fields',
      label: '字段',
      type: 'json',
      placeholder:
        'manual: { "status": "done" }；expression: { "url": "{{ $env.API_URL }}" }',
    },
  ],
  json: [
    {
      key: 'expression',
      label: 'JSON 表达式',
      type: 'textarea',
      placeholder: '{ "id": "{{ $json.id }}" } 或 ={{ $json }}',
    },
  ],
  executeWorkflow: [{ key: 'workflowId', label: '子工作流 ID', type: 'text' }],
  scheduleTrigger: [{ key: 'cron', label: 'Cron', type: 'text' }],
  mcpClient: [],
  skillRun: [
    {
      key: 'skillSource',
      label: '来源',
      type: 'select',
      options: ['path', 'registry'],
      default: 'path',
    },
    { key: 'workspaceRoot', label: '工作区', type: 'text' },
    {
      key: 'skillPath',
      label: 'Skill',
      type: 'text',
      placeholder: 'sample-skill',
    },
    {
      key: 'skillId',
      label: '注册中心 Skill ID',
      type: 'text',
      placeholder: 'uuid from Settings → RxWF',
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      placeholder: '留空则默认透传上游输入 JSON',
    },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
    { key: 'maxIterations', label: '最大迭代', type: 'number', default: '10', settingsTab: true },
    { key: 'timeoutMs', label: '超时 (ms)', type: 'number', default: '120000', settingsTab: true },
  ],
  workflow_run: [
    {
      key: 'workflowSource',
      label: '来源',
      type: 'select',
      options: ['template', 'published'],
      default: 'template',
    },
    {
      key: 'workflowRelPath',
      label: '模板路径',
      type: 'text',
      placeholder: 'startcycle',
    },
    { key: 'workflowId', label: '已发布工作流 ID', type: 'text' },
    { key: 'workspaceRoot', label: '工作区根目录', type: 'text' },
    {
      key: 'expandTemplate',
      label: '展开模板',
      type: 'select',
      options: ['true', 'false'],
      default: 'true',
    },
  ],
  aiAgent: [
    { key: 'role', label: '角色 (Crew)', type: 'text', placeholder: '研究员' },
    { key: 'goal', label: '目标 (Crew)', type: 'textarea' },
    { key: 'backstory', label: '背景 (Crew)', type: 'textarea' },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      placeholder: '留空则默认透传上游输入 JSON',
    },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
    { key: 'maxIterations', label: '最大迭代', type: 'number', default: '10', settingsTab: true },
    { key: 'sessionId', label: 'Session ID', type: 'text', placeholder: '{{ $json.sessionId }}' },
    {
      key: 'taskDescription',
      label: 'Task 描述 (CrewAI)',
      type: 'textarea',
      placeholder: '覆盖默认 Crew 任务描述',
    },
    {
      key: 'expectedOutput',
      label: '期望输出 (CrewAI)',
      type: 'textarea',
      placeholder: '映射 Task.expected_output',
    },
  ],
  aiChatModel: [
    {
      key: 'provider',
      label: 'Provider',
      type: 'select',
      options: ['ollama', 'openai-compatible'],
      default: 'ollama',
      optionLabelKeys: {
        ollama: 'editor.provider.ollama',
        'openai-compatible': 'editor.provider.openaiCompatible',
      },
    },
    {
      key: 'baseUrl',
      label: '服务地址',
      type: 'text',
      placeholder: 'http://127.0.0.1:11434',
    },
    { key: 'model', label: 'Model', type: 'text' },
    { key: 'credentialId', label: 'Credential ID', type: 'text' },
  ],
  aiMemory: [
    { key: 'sessionId', label: 'Session ID', type: 'text' },
    { key: 'maxTurns', label: 'Max turns', type: 'number' },
  ],
  toolMcp: [
    { key: 'serverId', label: 'MCP Server', type: 'text' },
    { key: 'toolDescription', label: 'Tool 描述', type: 'textarea' },
  ],
  toolHttp: [
    { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
    { key: 'url', label: 'URL', type: 'text', allowFromAi: true },
    { key: 'headers', label: 'Headers (JSON)', type: 'json', placeholder: '{ "Authorization": "Bearer x" }', allowFromAi: true },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: '{"q":"{{ $fromAI("query") }}"}', allowFromAi: true },
    { key: 'toolDescription', label: 'Tool 描述', type: 'textarea' },
  ],
  toolSubagent: [
    { key: 'toolDescription', label: 'Tool 描述', type: 'textarea' },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
    { key: 'taskPromptTemplate', label: 'Task 模板', type: 'textarea' },
    { key: 'maxIterations', label: '最大迭代', type: 'number' },
    {
      key: 'readonly',
      label: '只读子 Agent',
      type: 'select',
      options: ['false', 'true'],
      default: 'false',
    },
  ],
  toolSkill: [
    { key: 'toolDescription', label: 'Tool 描述', type: 'textarea' },
    { key: 'skillPath', label: 'Skill 名称', type: 'text', placeholder: 'hello' },
    {
      key: 'mode',
      label: '模式',
      type: 'select',
      options: ['sub-agent', 'single-shot'],
      default: 'sub-agent',
    },
  ],
  toolWorkflow: [
    { key: 'toolDescription', label: 'Tool 描述', type: 'textarea' },
    {
      key: 'inputMapping',
      label: 'Input mapping (JSON)',
      type: 'json',
      placeholder: '{"query": "{{ $fromAI(\\"query\\", \\"Search terms\\") }}"}',
      allowFromAi: true,
    },
  ],
  toolRead: [],
  toolWrite: [
    {
      key: 'defaultEncoding',
      label: '默认编码',
      type: 'select',
      options: ['utf8'],
      default: 'utf8',
    },
  ],
  toolGrep: [
    { key: 'maxResults', label: '最大结果数', type: 'number', default: '100' },
  ],
  toolShell: [
    { key: 'cwd', label: '工作目录', type: 'text', placeholder: '相对 scanRoots[0]' },
  ],
  toolWebSearch: [
    {
      key: 'inheritConfig',
      label: '继承系统配置',
      type: 'select',
      options: ['true', 'false'],
      default: 'true',
    },
    {
      key: 'credentialMode',
      label: '凭证模式',
      type: 'select',
      options: ['platform', 'runner-local'],
      default: 'platform',
    },
    { key: 'provider', label: 'Provider', type: 'text' },
    { key: 'credentialId', label: 'Credential ID', type: 'text' },
  ],
  aiOutputParser: [
    {
      key: 'jsonSchema',
      label: 'Output JSON Schema',
      type: 'json',
      placeholder: '{ "type": "object", "properties": { "answer": { "type": "string" } }, "required": ["answer"] }',
    },
  ],
  crewSequential: [
    CREW_EXECUTION_BACKEND,
    CREW_FLOW_MODE,
    CREW_FLOW_ROUTER,
    CREW_KNOWLEDGE_MODE,
    CREW_ENABLE_EVAL,
    CREW_BUILTIN_TOOLS,
  ],
  crewHierarchical: [
    CREW_EXECUTION_BACKEND,
    CREW_FLOW_MODE,
    CREW_KNOWLEDGE_MODE,
    CREW_ENABLE_EVAL,
    CREW_BUILTIN_TOOLS,
    { key: 'maxDelegations', label: '最大委派轮次', type: 'number' },
    {
      key: 'allowParallelDelegation',
      label: '允许并行委派',
      type: 'select',
      options: ['true', 'false'],
    },
  ],
  crewSupervisor: [
    CREW_EXECUTION_BACKEND,
    CREW_FLOW_MODE,
    CREW_KNOWLEDGE_MODE,
    CREW_ENABLE_EVAL,
    CREW_BUILTIN_TOOLS,
    { key: 'maxSteps', label: '最大监督步数', type: 'number' },
    {
      key: 'allowParallel',
      label: '允许并行批次',
      type: 'select',
      options: ['true', 'false'],
    },
    {
      key: 'supervisorProvider',
      label: 'Supervisor 模型',
      type: 'select',
      options: ['ollama', 'openai-compatible'],
    },
    { key: 'supervisorModel', label: 'Supervisor Model', type: 'text' },
    { key: 'supervisorBaseUrl', label: 'Supervisor Base URL', type: 'text' },
    { key: 'supervisorCredentialId', label: 'Supervisor Credential', type: 'text' },
  ],
  groupChat: [
    GROUP_EXECUTION_BACKEND,
    { key: 'maxRounds', label: '最大发言轮次', type: 'number' },
    {
      key: 'speakerSelection',
      label: '发言策略',
      type: 'select',
      options: ['roundRobin', 'orchestrator'],
    },
    {
      key: 'terminationKeywords',
      label: '终止关键词（逗号分隔）',
      type: 'text',
      placeholder: 'TERMINATE,FINISH,完成',
    },
    {
      key: 'returnTranscript',
      label: '输出完整 transcript',
      type: 'select',
      options: ['true', 'false'],
    },
    {
      key: 'returnTranscriptMarkdown',
      label: '输出 Markdown transcript',
      type: 'select',
      options: ['true', 'false'],
    },
    {
      key: 'userProxyEnabled',
      label: '启用 UserProxy',
      type: 'select',
      options: ['true', 'false'],
    },
    { key: 'userProxyPrompt', label: 'UserProxy 提示语', type: 'text' },
    { key: 'userProxyEveryNRounds', label: '每 N 轮暂停（0=仅 orchestrator 请求）', type: 'number' },
    {
      key: 'orchestratorProvider',
      label: 'Orchestrator 模型',
      type: 'select',
      options: ['ollama', 'openai-compatible'],
    },
    { key: 'orchestratorModel', label: 'Orchestrator Model', type: 'text' },
    { key: 'orchestratorBaseUrl', label: 'Orchestrator Base URL', type: 'text' },
    { key: 'orchestratorCredentialId', label: 'Orchestrator Credential', type: 'text' },
  ],
  aiKnowledge: [],
  splitInBatches: [{ key: 'batchSize', label: '批次大小', type: 'number' }],
  readWriteFile: [
    {
      key: 'operation',
      label: '操作',
      type: 'select',
      options: ['read', 'readBinary', 'write', 'writeBinary', 'append'],
      optionLabelKeys: {
        read: 'editor.readWriteFile.operation.read',
        readBinary: 'editor.readWriteFile.operation.readBinary',
        write: 'editor.readWriteFile.operation.write',
        writeBinary: 'editor.readWriteFile.operation.writeBinary',
        append: 'editor.readWriteFile.operation.append',
      },
    },
    { key: 'path', label: '路径', type: 'text', placeholder: '如 D:/downloads/image.png' },
    {
      key: 'binaryPropertyName',
      label: 'Binary 属性名',
      type: 'text',
      placeholder: '默认 data，需与 HTTP 节点 Binary 属性名一致',
      default: 'data',
    },
    {
      key: 'content',
      label: '内容（可选）',
      type: 'textarea',
      placeholder: 'Write：留空则写入上游 item.binary；Append：追加的文本',
    },
  ],
  postgres: [{ key: 'query', label: 'SQL', type: 'textarea' }],
  llm: [
    {
      key: 'provider',
      label: 'Provider',
      type: 'select',
      options: ['ollama', 'openai-compatible'],
      default: 'ollama',
      optionLabelKeys: {
        ollama: 'editor.provider.ollama',
        'openai-compatible': 'editor.provider.openaiCompatible',
      },
    },
    {
      key: 'baseUrl',
      label: '服务地址',
      type: 'text',
      placeholder: 'http://127.0.0.1:11434',
    },
    { key: 'credentialId', label: 'Credential', type: 'text' },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: '点击选择或输入模型名',
    },
    { key: 'prompt', label: 'Prompt', type: 'textarea' },
  ],
  llmStream: [
    {
      key: 'provider',
      label: 'Provider',
      type: 'select',
      options: ['ollama', 'openai-compatible'],
      default: 'ollama',
      optionLabelKeys: {
        ollama: 'editor.provider.ollama',
        'openai-compatible': 'editor.provider.openaiCompatible',
      },
    },
    {
      key: 'baseUrl',
      label: '服务地址',
      type: 'text',
      placeholder: 'http://127.0.0.1:11434',
    },
    { key: 'credentialId', label: 'Credential', type: 'text' },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: '点击选择或输入模型名',
    },
    { key: 'prompt', label: 'Prompt', type: 'textarea' },
  ],
  ragRetrieve: [
    { key: 'query', label: '查询', type: 'textarea', placeholder: '留空则取输入项 json.query' },
  ],
  ragAnswer: [
    {
      key: 'usePlatformRagModel',
      label: '使用平台 RAG 默认模型',
      type: 'select',
      options: ['true', 'false'],
      default: 'true',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      placeholder: '留空则使用设置中的默认模型',
    },
    { key: 'query', label: '问题', type: 'textarea' },
    {
      key: 'ragTemplate',
      label: '模板',
      type: 'select',
      options: ['support', 'code'],
    },
    {
      key: 'fallbackToChat',
      label: '无命中回退纯对话',
      type: 'select',
      options: ['true', 'false'],
    },
  ],
};

export function getParamSchema(nodeType: string): ParamField[] {
  return SCHEMAS[nodeType] ?? [];
}

export function getBasicParamSchema(nodeType: string): ParamField[] {
  return getParamSchema(nodeType).filter((f) => !f.settingsTab);
}

export function getSettingsParamSchema(nodeType: string): ParamField[] {
  return getParamSchema(nodeType).filter((f) => f.settingsTab);
}
