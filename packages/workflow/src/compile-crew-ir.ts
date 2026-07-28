import { collectSatellites } from './agent-satellites.js';
import { collectCrewManager, collectCrewWorkers } from './crew-members.js';
import type { AwfCrewIrV1, AwfCrewMemberIr, AwfCrewToolIr, CrewProcessType } from './crew-ir.js';
import { compileCrewFlowGraph, type CompileCrewFlowRouterInput } from './compile-crew-flow.js';
import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export interface CompileCrewIrInput {
  definition: WorkflowDefinition;
  crewNodeId: string;
  process: CrewProcessType;
  inputTask: string;
  execution: Omit<AwfCrewIrV1['execution'], 'crewNodeId'> & { crewNodeId?: string };
}

function parseKnowledgeBaseIds(config: Record<string, unknown>): string[] {
  const raw = config.knowledgeBaseIds;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = String(config.knowledgeBaseId ?? '').trim();
  return single ? [single] : [];
}

function parseBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseExecutionBackend(value: unknown): AwfCrewIrV1['executionBackend'] {
  if (value === 'crewai') return 'crewai';
  return 'native';
}

function extractCrewParams(params: Record<string, unknown>): AwfCrewIrV1['crewParams'] {
  const out: AwfCrewIrV1['crewParams'] = {};

  if (typeof params.maxIterations === 'number' && !Number.isNaN(params.maxIterations)) {
    out.maxIterations = params.maxIterations;
  }
  if (typeof params.maxDelegations === 'number' && !Number.isNaN(params.maxDelegations)) {
    out.maxDelegations = params.maxDelegations;
  }
  if (typeof params.maxSteps === 'number' && !Number.isNaN(params.maxSteps)) {
    out.maxSteps = params.maxSteps;
  }

  const allowParallel = parseBool(params.allowParallel);
  if (allowParallel !== undefined) out.allowParallel = allowParallel;

  const allowParallelDelegation = parseBool(params.allowParallelDelegation);
  if (allowParallelDelegation !== undefined) out.allowParallelDelegation = allowParallelDelegation;

  if (params.crewaiProcess === 'sequential' || params.crewaiProcess === 'hierarchical') {
    out.crewaiProcess = params.crewaiProcess;
  } else if (params.crewaiProcess === 'consensual') {
    out.crewaiProcess = 'consensual';
  }
  if (params.crewaiFlowMode === 'flow' || params.crewaiFlowMode === 'crew') {
    out.crewaiFlowMode = params.crewaiFlowMode;
  }
  const enableEval = parseBool(params.enableEval);
  if (enableEval !== undefined) out.enableEval = enableEval;
  if (params.crewaiKnowledgeMode === 'native' || params.crewaiKnowledgeMode === 'inject') {
    out.crewaiKnowledgeMode = params.crewaiKnowledgeMode;
  }
  if (typeof params.crewaiVersion === 'string' && params.crewaiVersion.trim()) {
    out.crewaiVersion = params.crewaiVersion.trim();
  }
  if (Array.isArray(params.enableBuiltinTools)) {
    const tools = params.enableBuiltinTools.filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    );
    if (tools.length > 0) out.enableBuiltinTools = tools;
  }

  const flowRouter = parseFlowRouter(params);
  if (flowRouter) out.flowRouter = flowRouter;

  return out;
}

function parseFlowRouter(
  params: Record<string, unknown>,
): NonNullable<AwfCrewIrV1['crewParams']['flowRouter']> | undefined {
  const raw = params.flowRouter;
  if (!raw || typeof raw !== 'object') return undefined;

  const o = raw as Record<string, unknown>;
  const afterMemberNodeId = String(o.afterMemberNodeId ?? '').trim();
  const defaultMemberNodeId = String(o.defaultMemberNodeId ?? '').trim();
  if (!afterMemberNodeId || !defaultMemberNodeId) return undefined;

  const branchesRaw = o.branches;
  if (!Array.isArray(branchesRaw) || branchesRaw.length === 0) return undefined;

  const branches: Array<{ condition: string; memberNodeId: string; label?: string }> = [];
  for (const item of branchesRaw) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    const condition = String(b.condition ?? '').trim();
    const memberNodeId = String(b.memberNodeId ?? '').trim();
    if (!condition || !memberNodeId) continue;
    const label = String(b.label ?? '').trim();
    branches.push({
      condition,
      memberNodeId,
      ...(label ? { label } : {}),
    });
  }

  if (branches.length === 0) return undefined;
  return { afterMemberNodeId, defaultMemberNodeId, branches };
}

function modelFromChatModelNode(modelNode: WorkflowNode | null): AwfCrewMemberIr['model'] {
  const params = modelNode?.parameters ?? {};
  const providerRaw = String(params.provider ?? 'ollama');
  const provider: AwfCrewMemberIr['model']['provider'] =
    providerRaw === 'openai-compatible' ? 'openai-compatible' : 'ollama';

  const model: AwfCrewMemberIr['model'] = {
    provider,
    model: String(params.model ?? 'llama3'),
  };
  if (params.baseUrl) model.baseUrl = String(params.baseUrl);
  const credentialRef = params.credentialRef ?? params.credentialId;
  if (credentialRef) model.credentialRef = String(credentialRef);
  return model;
}

function mapTools(agentNodeId: string, toolNodes: WorkflowNode[]): AwfCrewToolIr[] {
  const tools: AwfCrewToolIr[] = [];
  let bridgeIndex = 0;

  for (const toolNode of toolNodes) {
    const p = toolNode.parameters;
    const description = String(p.toolDescription ?? '').trim();

    if (toolNode.type === 'toolMcp') {
      const toolNames = Array.isArray(p.tools)
        ? (p.tools as unknown[]).filter(
            (t): t is string => typeof t === 'string' && t.length > 0,
          )
        : [];
      const list = toolNames.length > 0 ? toolNames : ['list_directory'];
      for (const toolName of list) {
        tools.push({
          type: 'mcp',
          bridgeId: `bridge_${agentNodeId}_${bridgeIndex}`,
          serverId: String(p.serverId ?? ''),
          toolName,
          description: description || toolName,
        });
        bridgeIndex += 1;
      }
    } else if (toolNode.type === 'toolHttp') {
      tools.push({
        type: 'http',
        bridgeId: `bridge_${agentNodeId}_${bridgeIndex}`,
        method: String(p.method ?? 'GET').toUpperCase(),
        url: String(p.url ?? ''),
        description: description || toolNode.name,
      });
      bridgeIndex += 1;
    } else if (toolNode.type === 'toolWorkflow') {
      tools.push({
        type: 'workflow',
        bridgeId: `bridge_${agentNodeId}_${bridgeIndex}`,
        workflowId: String(p.workflowId ?? ''),
        description: description || toolNode.name,
      });
      bridgeIndex += 1;
    }
  }

  return tools;
}

function compileMemberIr(definition: WorkflowDefinition, node: WorkflowNode): AwfCrewMemberIr {
  const params = node.parameters;
  const satellites = collectSatellites(definition, node.id);

  const member: AwfCrewMemberIr = {
    nodeId: node.id,
    name: node.name,
    model: modelFromChatModelNode(satellites.model),
    tools: mapTools(node.id, satellites.tools),
  };

  const role = String(params.role ?? '').trim();
  const goal = String(params.goal ?? '').trim();
  const backstory = String(params.backstory ?? '').trim();
  if (role) member.role = role;
  if (goal) member.goal = goal;
  if (backstory) member.backstory = backstory;

  if (satellites.memory) {
    const memoryParams = satellites.memory.parameters;
    member.memory = {
      sessionId: String(memoryParams.sessionId ?? ''),
      maxTurns: Number(memoryParams.maxTurns ?? 20),
    };
  }

  if (satellites.knowledge) {
    const knowledgeBaseIds = parseKnowledgeBaseIds(satellites.knowledge.parameters);
    if (knowledgeBaseIds.length > 0) {
      member.knowledge = { knowledgeBaseIds };
    }
  }

  const taskDescription = String(params.taskDescription ?? '').trim();
  const expectedOutput = String(params.expectedOutput ?? '').trim();
  const asyncExecution = parseBool(params.asyncExecution);
  if (taskDescription || expectedOutput || asyncExecution !== undefined) {
    member.task = {};
    if (taskDescription) member.task.description = taskDescription;
    if (expectedOutput) member.task.expectedOutput = expectedOutput;
    if (asyncExecution !== undefined) member.task.asyncExecution = asyncExecution;
  }

  return member;
}

function compileSupervisorManagerIr(
  definition: WorkflowDefinition,
  crewNode: WorkflowNode,
): AwfCrewMemberIr | undefined {
  const managerNode = collectCrewManager(definition, crewNode.id);
  if (managerNode) {
    return compileMemberIr(definition, managerNode);
  }

  const params = crewNode.parameters;
  const model = String(params.supervisorModel ?? '').trim();
  if (!model) return undefined;

  const providerRaw = String(params.supervisorProvider ?? 'ollama');
  const provider: AwfCrewMemberIr['model']['provider'] =
    providerRaw === 'openai-compatible' ? 'openai-compatible' : 'ollama';

  const manager: AwfCrewMemberIr = {
    nodeId: crewNode.id,
    name: crewNode.name,
    role: String(params.supervisorRole ?? 'Supervisor'),
    goal: String(params.supervisorGoal ?? 'Delegate tasks to workers and synthesize results'),
    model: {
      provider,
      model,
    },
    tools: [],
  };

  const backstory = String(params.supervisorBackstory ?? '').trim();
  if (backstory) manager.backstory = backstory;

  if (params.supervisorBaseUrl) {
    manager.model.baseUrl = String(params.supervisorBaseUrl);
  }
  const credentialRef = params.supervisorCredentialId ?? params.supervisorCredentialRef;
  if (credentialRef) {
    manager.model.credentialRef = String(credentialRef);
  }

  return manager;
}

function applyBuiltinToolsToMembers(ir: AwfCrewIrV1): void {
  const builtins = ir.crewParams.enableBuiltinTools ?? [];
  if (builtins.length === 0) return;

  for (const member of ir.members) {
    for (const name of builtins) {
      member.tools.push({ type: 'crewai-builtin', name });
    }
  }
}

export function compileCrewIr(input: CompileCrewIrInput): AwfCrewIrV1 {
  const { definition, crewNodeId, process, inputTask } = input;
  const crewNode = definition.nodes.find((n) => n.id === crewNodeId);
  const crewParams = extractCrewParams(crewNode?.parameters ?? {});
  const executionBackend = parseExecutionBackend(crewNode?.parameters?.executionBackend);

  const workerNodes = collectCrewWorkers(definition, crewNodeId);
  const members = workerNodes.map((node) => compileMemberIr(definition, node));

  let manager: AwfCrewMemberIr | undefined;
  if (process === 'hierarchical') {
    const managerNode = collectCrewManager(definition, crewNodeId);
    if (managerNode) {
      manager = compileMemberIr(definition, managerNode);
    }
  } else if (process === 'supervisor' && crewNode) {
    manager = compileSupervisorManagerIr(definition, crewNode);
  }

  const ir: AwfCrewIrV1 = {
    irVersion: 1,
    process,
    executionBackend,
    inputTask,
    crewParams,
    members,
    ...(manager ? { manager } : {}),
    execution: {
      ...input.execution,
      crewNodeId: input.execution.crewNodeId ?? crewNodeId,
    },
  };

  applyBuiltinToolsToMembers(ir);

  if (executionBackend === 'crewai' && crewParams.crewaiFlowMode === 'flow') {
    const routerInput: CompileCrewFlowRouterInput | undefined = crewParams.flowRouter
      ? {
          afterMemberNodeId: crewParams.flowRouter.afterMemberNodeId,
          defaultMemberNodeId: crewParams.flowRouter.defaultMemberNodeId,
          branches: crewParams.flowRouter.branches,
        }
      : undefined;
    ir.flowGraph = compileCrewFlowGraph(members, routerInput);
  }

  return ir;
}
