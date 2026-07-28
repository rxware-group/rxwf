import {
  defaultSwitchParameters,
  parseSwitchBranches,
  switchBranchIndex,
} from './switch-branches.js';
import type { WorkflowItem } from './editor-debug-types.js';

export interface PortDef {
  id: string;
  label: string;
  /** main = 左右数据流；resource = 上下参数流（虚线） */
  kind?: 'main' | 'resource';
  required?: boolean;
}

export interface NodeTypePorts {
  inputs: PortDef[];
  outputs: PortDef[];
  /** Agent 等：底部参数输入（target） */
  resourceInputs?: PortDef[];
  /** 卫星节点：顶部参数输出（source） */
  resourceOutputs?: PortDef[];
}

export function isResourcePortId(id: string): boolean {
  return id.startsWith('ai_') || id.startsWith('crew_') || id.startsWith('group_');
}

export function isResourceConnection(
  fromOutput?: string | null,
  toInput?: string | null,
): boolean {
  return isResourcePortId(fromOutput ?? '') || isResourcePortId(toInput ?? '');
}

/** Infer satellite resource output when legacy connections omit fromOutput. */
export function resolveConnectionFromOutput(
  fromNodeType: string | undefined,
  fromOutput: string | undefined,
  toInput: string | undefined,
): string {
  const output = fromOutput ?? 'main';
  const input = toInput ?? 'main';
  if (!fromNodeType || output !== 'main' || !isResourcePortId(input)) {
    return output;
  }
  const resourceOutputs = getNodePorts(fromNodeType, {}).resourceOutputs ?? [];
  if (resourceOutputs.some((p) => p.id === input)) {
    return input;
  }
  if (resourceOutputs.length === 1) {
    return resourceOutputs[0]!.id;
  }
  return output;
}

const TRIGGERS = new Set([
  'manualTrigger',
  'webhookTrigger',
  'scheduleTrigger',
  'errorTrigger',
  'subworkflowTrigger',
]);

export function isTriggerNodeType(type: string): boolean {
  return TRIGGERS.has(type);
}

export type GetNodePortsOptions = {
  enableCrew?: boolean;
};

export function getNodePorts(
  type: string,
  parameters?: Record<string, unknown>,
  options?: GetNodePortsOptions,
): NodeTypePorts {
  const enableCrew = options?.enableCrew !== false;
  if (type === 'stickyNote') {
    return { inputs: [], outputs: [] };
  }
  if (TRIGGERS.has(type)) {
    return { inputs: [], outputs: [{ id: 'main', label: '输出' }] };
  }

  switch (type) {
    case 'if':
      return {
        inputs: [{ id: 'main', label: '输入' }],
        outputs: [
          { id: '0', label: 'true' },
          { id: '1', label: 'false' },
        ],
      };
    case 'switch': {
      const branches = parseSwitchBranches(parameters);
      const outputs =
        branches.length > 0
          ? branches.map((b, i) => ({
              id: b.id,
              label: b.label || `端口${i + 1}`,
            }))
          : [{ id: 'main', label: '端口1' }];
      return {
        inputs: [{ id: 'main', label: '输入' }],
        outputs,
      };
    }
    case 'crewSequential': {
      const ports: NodeTypePorts = {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
      };
      if (enableCrew) {
        ports.resourceInputs = [
          { id: 'crew_member', label: 'Crew 成员', kind: 'resource' },
        ];
      }
      return ports;
    }
    case 'crewHierarchical': {
      const ports: NodeTypePorts = {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
      };
      if (enableCrew) {
        ports.resourceInputs = [
          { id: 'crew_manager', label: '经理', kind: 'resource', required: true },
          { id: 'crew_member', label: '工人', kind: 'resource' },
        ];
      }
      return ports;
    }
    case 'crewSupervisor': {
      const ports: NodeTypePorts = {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
      };
      if (enableCrew) {
        ports.resourceInputs = [
          { id: 'crew_manager', label: '经理 (可选)', kind: 'resource' },
          { id: 'crew_member', label: '工人', kind: 'resource' },
        ];
      }
      return ports;
    }
    case 'groupChat': {
      const ports: NodeTypePorts = {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
      };
      if (enableCrew) {
        ports.resourceInputs = [
          { id: 'group_member', label: '群聊成员', kind: 'resource' },
          { id: 'group_orchestrator', label: 'Orchestrator (可选)', kind: 'resource' },
        ];
      }
      return ports;
    }
    case 'aiAgent': {
      const ports: NodeTypePorts = {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
        resourceInputs: [
          { id: 'ai_languageModel', label: 'Chat Model', kind: 'resource', required: true },
          { id: 'ai_memory', label: 'Memory', kind: 'resource' },
          { id: 'ai_knowledge', label: 'Knowledge', kind: 'resource' },
          { id: 'ai_outputParser', label: 'Output Parser', kind: 'resource' },
          { id: 'ai_tool', label: 'Tool', kind: 'resource' },
        ],
      };
      if (enableCrew) {
        ports.resourceOutputs = [
          { id: 'crew_member', label: 'Crew 工人', kind: 'resource' },
          { id: 'crew_manager', label: 'Crew 经理', kind: 'resource' },
          { id: 'group_member', label: '群聊成员', kind: 'resource' },
          { id: 'group_orchestrator', label: '群聊 Orchestrator', kind: 'resource' },
        ];
      }
      return ports;
    }
    case 'skillRun':
      return {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [
          { id: 'main', label: '输出', kind: 'main' },
          { id: 'ai_instruction', label: 'Instruction', kind: 'resource' },
        ],
        resourceInputs: [
          { id: 'ai_languageModel', label: 'Chat Model', kind: 'resource', required: true },
          { id: 'ai_memory', label: 'Memory', kind: 'resource' },
          { id: 'ai_tool', label: 'Tool', kind: 'resource' },
          { id: 'ai_instruction', label: 'Rule / Instruction', kind: 'resource' },
        ],
      };
    case 'workflow_run':
      return {
        inputs: [{ id: 'main', label: '输入', kind: 'main' }],
        outputs: [{ id: 'main', label: '输出', kind: 'main' }],
      };
    case 'aiOutputParser':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [
          { id: 'ai_outputParser', label: 'Output Parser', kind: 'resource' },
        ],
      };
    case 'aiChatModel':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [
          { id: 'ai_languageModel', label: 'Model', kind: 'resource' },
        ],
      };
    case 'aiMemory':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [{ id: 'ai_memory', label: 'Memory', kind: 'resource' }],
      };
    case 'aiKnowledge':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [{ id: 'ai_knowledge', label: 'Knowledge', kind: 'resource' }],
      };
    case 'toolMcp':
    case 'toolHttp':
    case 'toolWorkflow':
    case 'toolRead':
    case 'toolWrite':
    case 'toolGrep':
    case 'toolShell':
    case 'toolWebSearch':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [{ id: 'ai_tool', label: 'Tool', kind: 'resource' }],
      };
    case 'toolSubagent':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [{ id: 'ai_tool', label: 'Subagent', kind: 'resource' }],
        resourceInputs: [{ id: 'ai_tool', label: '子 Tool', kind: 'resource' }],
      };
    case 'toolSkill':
      return {
        inputs: [],
        outputs: [],
        resourceOutputs: [{ id: 'ai_tool', label: 'Skill Tool', kind: 'resource' }],
      };
    case 'merge': {
      const count = Math.min(
        8,
        Math.max(2, Number(parameters?.inputCount ?? 2) || 2),
      );
      return {
        inputs: Array.from({ length: count }, (_, i) => ({
          id: String(i),
          label: `输入 ${i + 1}`,
        })),
        outputs: [{ id: 'main', label: '输出' }],
      };
    }
    case 'loop':
      return {
        inputs: [{ id: 'main', label: '输入' }],
        outputs: [
          { id: '1', label: 'done' },
          { id: '0', label: 'loop' },
        ],
      };
    default:
      return {
        inputs: [{ id: 'main', label: '输入' }],
        outputs: [{ id: 'main', label: '输出' }],
      };
  }
}

export type OutputHandleIndexContext = {
  nodeType?: string;
  parameters?: Record<string, unknown>;
  outputIndex?: number;
};

/** Maps handle id to execution engine output branch index */
export function outputHandleToIndex(
  handle?: string | null,
  context?: OutputHandleIndexContext,
): number {
  if (context?.nodeType === 'switch') {
    return switchBranchIndex(context.parameters, handle, context.outputIndex);
  }
  if (typeof context?.outputIndex === 'number' && context.outputIndex >= 0) {
    return context.outputIndex;
  }
  if (!handle || handle === 'main') return 0;
  const n = Number(handle);
  if (!Number.isNaN(n) && n >= 0) return n;
  if (handle === 'true') return 0;
  if (handle === 'false') return 1;
  return 0;
}

export function getOutputBranchLabels(
  type: string,
  parameters?: Record<string, unknown>,
): string[] {
  return getNodePorts(type, parameters).outputs.map((port) => port.label);
}

/** Map execution outputItems branches to UI port labels (handle id → branch index). */
export function mapNodeOutputBranches(
  type: string,
  parameters: Record<string, unknown> | undefined,
  outputItems: WorkflowItem[][],
): Array<{ label: string; branchIndex: number; items: WorkflowItem[] }> {
  const ports = getNodePorts(type, parameters).outputs;
  if (ports.length <= 1) return [];
  return ports.map((port) => {
    const branchIndex = outputHandleToIndex(port.id, { nodeType: type, parameters });
    return {
      label: port.label,
      branchIndex,
      items: outputItems[branchIndex] ?? [],
    };
  });
}

export function defaultNodeParameters(type: string): Record<string, unknown> {
  switch (type) {
    case 'httpRequest':
      return {
        url: 'https://httpbin.org/get',
        method: 'GET',
        sendHeaders: false,
        sendQuery: false,
        sendBody: false,
        headerParameters: [{ enabled: true, key: '', value: '' }],
        queryParameters: [{ enabled: true, key: '', value: '' }],
        bodyContentType: 'none',
        rawContentType: 'json',
        responseBodyContentType: 'json',
        responseBinaryMode: 'off',
        responseBinaryPropertyName: 'data',
        binaryBodyPropertyName: 'data',
        body: '',
        bodyParameters: [{ enabled: true, key: '', value: '' }],
      };
    case 'if':
      return {
        condition: '{{ $json.active === true }}',
      };
    case 'switch':
      return defaultSwitchParameters();
    case 'merge':
      return { mode: 'append', inputCount: 2 };
    case 'loop':
      return { batchSize: 1 };
    case 'code':
      return {
        jsCode: `return $input.map((item) => ({
  json: item.json,
}));`,
        timeoutMs: -1,
      };
    case 'executeCommand':
      return { command: 'echo', args: ['rxwf'], timeoutMs: -1, cwd: '' };
    case 'wait':
      return { ms: 1000 };
    case 'humanApproval':
      return {
        prompt: '请审批后继续执行',
        summaryField: '',
        allowReject: 'true',
        allowSupplement: 'false',
        timeoutMs: 0,
        timeoutAction: 'reject',
      };
    case 'set':
      return { mode: 'manual', fields: {} };
    case 'json':
      return { expression: '{}' };
    case 'executeWorkflow':
      return { workflowId: '', inputMapping: {} };
    case 'subworkflowTrigger':
      return { inputMode: 'fields', inputs: [], jsonExample: {} };
    case 'manualTrigger':
      return { json: {} };
    case 'scheduleTrigger':
      return { cron: '0 * * * *' };
    case 'errorTrigger':
      return {
        _debugSamplePayload: {
          executionId: 'ex-sample',
          workflowId: 'wf-sample',
          failedNode: 'HTTP Request',
          errorMessage: 'Sample error for manual test',
          stack: 'Error: Sample error for manual test',
          timestamp: new Date().toISOString(),
        },
      };
    case 'webhookTrigger':
      return { path: 'hook', authMode: 'none', apiKey: '', hmacSecret: '' };
    case 'stickyNote':
      return { content: '# 说明\n\n在此填写备注（Markdown）' };
    case 'mcpClient':
      return { serverId: '', tools: [] as string[] };
    case 'crewSequential':
      return {};
    case 'crewHierarchical':
      return { maxDelegations: 10, allowParallelDelegation: true };
    case 'crewSupervisor':
      return {
        maxSteps: 15,
        allowParallel: true,
        supervisorProvider: 'ollama',
        supervisorModel: 'llama3',
        supervisorCredentialId: '',
      };
    case 'groupChat':
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
        orchestratorProvider: 'ollama',
        orchestratorModel: 'llama3',
        orchestratorCredentialId: '',
      };
    case 'aiAgent':
      return {
        role: '',
        goal: '',
        backstory: '',
        prompt: '',
        systemPrompt: '',
        maxIterations: 10,
        timeoutMs: 120_000,
        returnIntermediateSteps: true,
        sessionId: '',
      };
    case 'aiChatModel':
      return {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3',
      };
    case 'llm':
      return {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: '',
        prompt: '',
      };
    case 'llmStream':
      return {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: '',
        prompt: '',
      };
    case 'aiMemory':
      return { sessionId: '', maxTurns: 20 };
    case 'aiKnowledge':
      return { knowledgeBaseIds: [] as string[] };
    case 'toolMcp':
      return { serverId: '', tools: [] as string[], toolDescription: '' };
    case 'toolHttp':
      return {
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: {},
        body: '',
        toolDescription: '',
      };
    case 'toolWorkflow':
      return { workflowId: '', toolDescription: '', inputMapping: {} };
    case 'toolSkill':
      return {
        toolDescription: '',
        skillPath: 'hello',
        mode: 'sub-agent',
      };
    case 'toolRead':
    case 'toolGrep':
      return {};
    case 'toolWrite':
      return { defaultEncoding: 'utf8' };
    case 'toolShell':
      return { cwd: '' };
    case 'toolWebSearch':
      return {
        inheritConfig: true,
        credentialMode: 'platform',
        provider: '',
        credentialId: '',
      };
    case 'toolSubagent':
      return {
        toolDescription: '',
        systemPrompt: '',
        taskPromptTemplate: '{{ $fromAI("task", "Task for the subagent") }}',
        maxIterations: 10,
        readonly: 'false',
      };
    case 'aiOutputParser':
      return {
        jsonSchema: {
          type: 'object',
          properties: { answer: { type: 'string' } },
          required: ['answer'],
        },
      };
    case 'readWriteFile':
      return {
        operation: 'write',
        path: '',
        binaryPropertyName: 'data',
        content: '',
      };
    default:
      return {};
  }
}
