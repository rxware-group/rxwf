export type NodeCategory =
  | 'trigger'
  | 'action'
  | 'logic'
  | 'data'
  | 'note'
  | 'agent'
  | 'plus';

export interface NodeTypeMeta {
  label: string;
  category: NodeCategory;
  icon: string;
  accent: string;
  /** 属性面板中展示的简短说明 */
  description: string;
}

export const NODE_TYPE_META: Record<string, NodeTypeMeta> = {
  manualTrigger: {
    label: 'Manual',
    category: 'trigger',
    icon: '↖',
    accent: '#6b7280',
    description: '手动触发工作流，用于调试或一次性运行。',
  },
  webhookTrigger: {
    label: 'Webhook',
    category: 'trigger',
    icon: '⚡',
    accent: '#a855f7',
    description: '通过 HTTP 请求触发，将请求体作为下游节点的输入数据。',
  },
  scheduleTrigger: {
    label: 'Schedule',
    category: 'trigger',
    icon: '⏱',
    accent: '#14b8a6',
    description: '按计划定时触发工作流（如 Cron 表达式）。',
  },
  errorTrigger: {
    label: 'Error Trigger',
    category: 'trigger',
    icon: '⚠',
    accent: '#ef4444',
    description:
      '接收 Error Workflow 失败载荷（executionId、failedNode、errorMessage 等）；手动调试可用样例载荷。',
  },
  subworkflowTrigger: {
    label: 'Sub-workflow',
    category: 'trigger',
    icon: '⎇',
    accent: '#3b82f6',
    description: '被其他工作流或 Agent Tool 调用时的入口；在此声明入参 schema。',
  },
  httpRequest: {
    label: 'HTTP',
    category: 'action',
    icon: '🌐',
    accent: '#3b82f6',
    description: '向上游输出的每条数据发起 HTTP 请求，并将响应写入输出。',
  },
  if: {
    label: 'IF',
    category: 'logic',
    icon: '',
    accent: '#22c55e',
    description:
      '按 {{ }} JavaScript 条件分流；支持 $json / $binary / $env / $vars / $input / $nodes / $execution / $workflow。',
  },
  switch: {
    label: 'Switch',
    category: 'logic',
    icon: '',
    accent: '#f97316',
    description:
      '按 {{ }} 条件自上而下匹配，将每条输入路由到第一个为 true 的分支；无匹配则丢弃。',
  },
  merge: {
    label: 'Merge',
    category: 'logic',
    icon: '⊕',
    accent: '#06b6d4',
    description: '合并多个上游分支的输出，供后续节点继续处理。',
  },
  loop: {
    label: 'Loop',
    category: 'logic',
    icon: '↻',
    accent: '#6366f1',
    description:
      '按输入 Items 迭代执行循环体（出口 0）；全部完成后从出口 1 (done) 输出汇总结果。',
  },
  set: {
    label: 'Set',
    category: 'data',
    icon: '✎',
    accent: '#3b82f6',
    description: '设置或覆盖字段值，常用于整理、映射上游 JSON 数据。',
  },
  json: {
    label: 'JSON',
    category: 'data',
    icon: '{ }',
    accent: '#8b5cf6',
    description: '解析、转换或生成 JSON 结构。',
  },
  wait: {
    label: 'Wait',
    category: 'action',
    icon: '⏸',
    accent: '#64748b',
    description: '暂停执行指定时间后再将数据传递给下游。',
  },
  humanApproval: {
    label: 'Human Approval',
    category: 'logic',
    icon: '👤',
    accent: '#ffd43b',
    description: '暂停工作流，等待人工审批（通过/驳回）后继续。',
  },
  code: {
    label: 'Code',
    category: 'action',
    icon: '',
    accent: '#ef4444',
    description:
      '在沙箱中运行 JavaScript；可用变量见下方说明表。',
  },
  executeCommand: {
    label: 'Execute Command',
    category: 'action',
    icon: '⌘',
    accent: '#a78bfa',
    description:
      '在服务器上执行 Shell 命令；每条输入可通过环境变量 RXWF_JSON 读取对应 JSON。',
  },
  executeWorkflow: {
    label: 'Sub',
    category: 'action',
    icon: '↪',
    accent: '#0ea5e9',
    description: '调用另一个工作流作为子流程，并传递当前数据。',
  },
  stickyNote: {
    label: '便签',
    category: 'note',
    icon: '📝',
    accent: '#eab308',
    description: '画布注释（Markdown），不参与执行。',
  },
  splitInBatches: {
    label: 'Split In Batches',
    category: 'logic',
    icon: '⊞',
    accent: '#f59e0b',
    description: '将输入分批处理。',
  },
  readWriteFile: {
    label: 'Read/Write File',
    category: 'action',
    icon: '📁',
    accent: '#84cc16',
    description: '读写文件。',
  },
  postgres: {
    label: 'Postgres',
    category: 'action',
    icon: '🐘',
    accent: '#336791',
    description: '执行 SQL 查询。',
  },
  llm: {
    label: 'LLM',
    category: 'action',
    icon: '🤖',
    accent: '#10b981',
    description: '单轮 LLM 对话（Ollama / OpenAI 兼容）。',
  },
  llmStream: {
    label: 'LLM Stream',
    category: 'action',
    icon: '≋',
    accent: '#8b5cf6',
    description: '流式 LLM 输出。',
  },
  ragRetrieve: {
    label: 'RAG 检索',
    category: 'action',
    icon: '🔍',
    accent: '#0ea5e9',
    description: '从知识库检索相关片段（不调用 LLM）。',
  },
  ragAnswer: {
    label: 'RAG 问答',
    category: 'action',
    icon: '📚',
    accent: '#06b6d4',
    description: '检索知识库并生成带引用的回答。',
  },
  mcpClient: {
    label: 'MCP Client',
    category: 'action',
    icon: '🔌',
    accent: '#ec4899',
    description: '调用已注册的 MCP Server 工具。',
  },
  crewSequential: {
    label: 'Crew (顺序)',
    category: 'agent',
    icon: '👥',
    accent: '#f59e0b',
    description: '按画布顺序依次运行多个 AI Agent 角色，上一角色输出传给下一角色。',
  },
  crewHierarchical: {
    label: 'Crew (层级)',
    category: 'agent',
    icon: '🧭',
    accent: '#ea580c',
    description: '经理 Agent 动态委派工人 Agent，完成后汇总答案。',
  },
  crewSupervisor: {
    label: 'Crew (Supervisor)',
    category: 'agent',
    icon: '🎯',
    accent: '#dc2626',
    description: '监督者每步动态选择工人（可重复调用），支持并行批次。',
  },
  groupChat: {
    label: 'Group Chat',
    category: 'agent',
    icon: '💬',
    accent: '#0891b2',
    description: '多 Agent 群聊：round-robin 或 orchestrator 发言，支持 UserProxy 人工插话。',
  },
  aiAgent: {
    label: 'AI Agent',
    category: 'agent',
    icon: '🤖',
    accent: '#a855f7',
    description: 'Tools Agent：连接 Chat Model、Memory 与 Tool；可作为 Crew 成员。',
  },
  aiChatModel: {
    label: 'Chat Model',
    category: 'agent',
    icon: '💬',
    accent: '#8b5cf6',
    description: '连接到 Agent 的语言模型（Ollama / OpenAI 兼容）。',
  },
  aiMemory: {
    label: 'Memory',
    category: 'agent',
    icon: '🧠',
    accent: '#3b82f6',
    description: '跨执行的会话记忆（sessionId）。',
  },
  aiKnowledge: {
    label: 'Knowledge (RAG)',
    category: 'agent',
    icon: '📚',
    accent: '#0ea5e9',
    description: '连接知识库，将检索片段注入 Agent 系统提示。',
  },
  aiOutputParser: {
    label: 'Output Parser',
    category: 'agent',
    icon: '📋',
    accent: '#f59e0b',
    description: '约束 Agent 最终输出为结构化 JSON。',
  },
  toolMcp: {
    label: 'Tool (MCP)',
    category: 'agent',
    icon: '🔌',
    accent: '#22c55e',
    description: 'Agent 可调用的 MCP 工具。',
  },
  toolHttp: {
    label: 'Tool (HTTP)',
    category: 'agent',
    icon: '🌐',
    accent: '#22c55e',
    description: 'Agent 可调用的 HTTP 请求工具。',
  },
  toolWorkflow: {
    label: 'Tool (Workflow)',
    category: 'agent',
    icon: '↪',
    accent: '#22c55e',
    description: '将另一条工作流作为 Agent 工具同步执行。',
  },
  toolSkill: {
    label: 'Tool (Skill)',
    category: 'agent',
    icon: '✦',
    accent: '#14b8a6',
    description: '将 .rxwf/skills 下的 Skill 包作为 Agent / Skill Run 的工具调用。',
  },
  toolSubagent: {
    label: 'Tool (Subagent)',
    category: 'agent',
    icon: '⑂',
    accent: '#8b5cf6',
    description: '嵌套子 Agent（ReAct）；可再接子 Tool 卫星。',
  },
  toolRead: {
    label: 'Tool (Read)',
    category: 'agent',
    icon: '📖',
    accent: '#22c55e',
    description: 'Agent 可读工作区内的文件（filesystem read）。',
  },
  toolWrite: {
    label: 'Tool (Write)',
    category: 'agent',
    icon: '✎',
    accent: '#22c55e',
    description: 'Agent 可写入工作区内的文件。',
  },
  toolGrep: {
    label: 'Tool (Grep)',
    category: 'agent',
    icon: '🔍',
    accent: '#22c55e',
    description: 'Agent 可在工作区内搜索文件内容。',
  },
  toolShell: {
    label: 'Tool (Shell)',
    category: 'agent',
    icon: '⌘',
    accent: '#22c55e',
    description: 'Agent 可在工作区内执行 Shell 命令。',
  },
  toolWebSearch: {
    label: 'Tool (Web Search)',
    category: 'agent',
    icon: '🌐',
    accent: '#22c55e',
    description: 'Agent 可搜索网络获取最新信息。',
  },
  skillRun: {
    label: 'Skill Run',
    category: 'agent',
    icon: '✦',
    accent: '#14b8a6',
    description:
      '执行 .rxwf/skills 下的 SKILL.md；须连接 Chat Model 卫星，支持 path / 内联 / 注册中心来源。',
  },
  workflow_run: {
    label: 'Workflow Run',
    category: 'action',
    icon: '⎇',
    accent: '#0d9488',
    description:
      '加载 .rxwf/workflows 模板并编译为子工作流执行（linear skillRun）；需填写 workspaceRoot。',
  },
};

export const PLUS_NODE_TYPES = [
  'splitInBatches',
  'readWriteFile',
  'postgres',
  'llm',
  'llmStream',
  'ragRetrieve',
  'ragAnswer',
  'mcpClient',
  'crewSequential',
  'crewHierarchical',
  'crewSupervisor',
  'groupChat',
  'aiAgent',
  'aiChatModel',
  'aiMemory',
  'aiKnowledge',
  'aiOutputParser',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
  'toolSkill',
  'toolSubagent',
  'toolRead',
  'toolWrite',
  'toolGrep',
  'toolShell',
  'toolWebSearch',
  'skillRun',
  'workflow_run',
  'subworkflowTrigger',
] as const;

export function getNodeMeta(type: string): NodeTypeMeta {
  return (
    NODE_TYPE_META[type] ?? {
      label: type,
      category: 'action',
      icon: '●',
      accent: '#6b7280',
      description: '自定义或未注册的节点类型。',
    }
  );
}
