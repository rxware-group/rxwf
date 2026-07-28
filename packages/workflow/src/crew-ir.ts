export type CrewExecutionBackend = 'native' | 'crewai';

export type CrewProcessType = 'sequential' | 'hierarchical' | 'supervisor';

export type AwfCrewFlowNodeType = 'start' | 'task' | 'router' | 'end';

export interface AwfCrewFlowRouterBranchIr {
  label: string;
  next: string;
  /** P4-D3+: e.g. `contains:keyword`, `equals:value`, `json.field:value` */
  condition?: string;
}

export interface AwfCrewFlowNodeIr {
  id: string;
  type: AwfCrewFlowNodeType;
  memberNodeId?: string;
  router?: {
    defaultNext: string;
    branches: AwfCrewFlowRouterBranchIr[];
  };
}

export interface AwfCrewFlowEdgeIr {
  from: string;
  to: string;
}

/** P4-D3: linear / router subset for CrewAI Flows adapter */
export interface AwfCrewFlowGraphIr {
  entryNodeId: string;
  nodes: AwfCrewFlowNodeIr[];
  edges: AwfCrewFlowEdgeIr[];
}

export interface AwfCrewEvalCriterionIr {
  name: string;
  score: number;
  notes?: string;
}

/** P4-D3: Sidecar post-kickoff evaluation summary */
export interface AwfCrewEvalIr {
  overallScore: number;
  criteria: AwfCrewEvalCriterionIr[];
}

export interface AwfCrewIrV1 {
  irVersion: 1;
  process: CrewProcessType;
  executionBackend: CrewExecutionBackend;
  inputTask: string;
  crewParams: {
    maxIterations?: number;
    maxDelegations?: number;
    maxSteps?: number;
    allowParallel?: boolean;
    allowParallelDelegation?: boolean;
    crewaiProcess?: 'sequential' | 'hierarchical' | 'consensual';
    crewaiVersion?: string;
    enableBuiltinTools?: string[];
    /** P4-D3: `flow` uses flowGraph + Flow runner instead of Crew.kickoff */
    crewaiFlowMode?: 'crew' | 'flow';
    /** P4-D3+: `inject` appends RAG to backstory; `native` uses CrewAI knowledge_sources */
    crewaiKnowledgeMode?: 'inject' | 'native';
    /** P4-D3: request Sidecar post-run eval summary */
    enableEval?: boolean;
    /** Optional router inserted into flowGraph when crewaiFlowMode is flow */
    flowRouter?: {
      afterMemberNodeId: string;
      branches: Array<{ condition: string; memberNodeId: string; label?: string }>;
      defaultMemberNodeId: string;
    };
  };
  /** Present when crewParams.crewaiFlowMode === 'flow' */
  flowGraph?: AwfCrewFlowGraphIr;
  manager?: AwfCrewMemberIr;
  members: AwfCrewMemberIr[];
  execution: {
    executionId: string;
    workflowId: string;
    crewNodeId: string;
    sessionId?: string;
    environment: 'test' | 'prod';
    toolBridgeBaseUrl: string;
    toolBridgeToken: string;
  };
}

export interface AwfCrewMemberIr {
  nodeId: string;
  name: string;
  role?: string;
  goal?: string;
  backstory?: string;
  model: {
    provider: 'ollama' | 'openai-compatible';
    model: string;
    baseUrl?: string;
    credentialRef?: string;
  };
  memory?: {
    sessionId: string;
    maxTurns: number;
    /** P4-D2: injected by node-runner from agentMemory before Sidecar kickoff */
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  };
  knowledge?: {
    knowledgeBaseIds: string[];
    /** P4-D4: pre-retrieved chunks for Sidecar native knowledge adapter */
    chunks?: Array<{ text: string; documentName?: string; score?: number }>;
  };
  tools: AwfCrewToolIr[];
  task?: { description?: string; expectedOutput?: string; asyncExecution?: boolean };
}

export type AwfCrewToolIr =
  | { type: 'mcp'; bridgeId: string; serverId: string; toolName: string; description: string }
  | { type: 'http'; bridgeId: string; method: string; url: string; description: string }
  | { type: 'workflow'; bridgeId: string; workflowId: string; description: string }
  | { type: 'crewai-builtin'; name: string };
