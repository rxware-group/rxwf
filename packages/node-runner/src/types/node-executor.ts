import type { NodeOutputEntry } from '@rxwf/expression';
import type { AgentStepRecord } from '@rxwf/ai-runtime-stub';
import type { SandboxLogEntry } from '@rxwf/sandbox';
import type { WorkflowItem } from '@rxwf/shared';

export interface ErrorWorkflowPayload {
  executionId: string;
  workflowId: string;
  failedNode: string;
  errorMessage: string;
  stack?: string;
  timestamp: string;
}

import type { GroupChatCheckpoint } from '../executors/group-chat-helpers.js';

export interface OrchestrationResume {
  kind: 'groupChat';
  checkpoint: GroupChatCheckpoint;
  userMessage: string;
}

export interface NodeExecutionContext {
  config: Record<string, unknown>;
  /** Resolved workflow/user/global env for {{ $env.* }} */
  env?: Record<string, string>;
  /** Resolved workflow/user/global vars for {{ $vars.* }} */
  vars?: Record<string, string>;
  /** Preceding nodes' outputs for {{ $nodes["name"].json.* }} */
  nodes?: NodeOutputEntry[];
  inputItems: WorkflowItem[];
  /** Multi-input nodes (e.g. Merge): one item list per input branch */
  inputBranches?: WorkflowItem[][];
  /** Error trigger node: standard failure payload */
  errorPayload?: ErrorWorkflowPayload;
  /** Subworkflow: current nesting depth (0 = root execution) */
  subworkflowDepth?: number;
  parentExecutionId?: string;
  executionId?: string;
  /** `production` | `manual` | `partial` — maps to `$execution.mode` */
  executionMode?: 'production' | 'manual' | 'partial';
  /** `test` | `prod` — maps to `$execution.environment` */
  executionEnvironment?: 'test' | 'prod';
  executionStartedAt?: string;
  workflowId?: string;
  workflowVersionId?: string;
  nodeId?: string;
  sessionId?: string;
  workflowDefinition?: import('@rxwf/workflow').WorkflowDefinition;
  onAgentStream?: (
    chunk: import('@rxwf/ai-runtime-stub').AiStreamChunk,
  ) => void;
  onSatelliteStream?: (
    satelliteNodeId: string,
    chunk: import('@rxwf/ai-runtime-stub').AiStreamChunk,
  ) => void;
  orchestrationResume?: OrchestrationResume;
  /** User interface locale for localized built-in tool descriptions. */
  locale?: string;
}

export interface NodeRunResult {
  status: 'success' | 'failed' | 'skipped' | 'waiting';
  outputItems?: WorkflowItem[][];
  errorCode?: string;
  errorMessage?: string;
  logs?: SandboxLogEntry[];
  metadata?: {
    agentSteps?: AgentStepRecord[];
    crewEval?: import('@rxwf/workflow').AwfCrewEvalIr;
    hitl?: Record<string, unknown>;
    groupChat?: Record<string, unknown>;
  };
}

export interface NodeExecutor {
  readonly type: string;
  execute(ctx: NodeExecutionContext): Promise<NodeRunResult>;
}
