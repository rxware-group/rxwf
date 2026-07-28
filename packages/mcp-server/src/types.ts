import type { WorkflowDefinition } from '@rxwf/workflow';

export interface McpWorkflowSummary {
  id: string;
  name: string;
  status: string;
  version: number;
}

export interface McpRunnerSummary {
  id: string;
  name: string;
  kind: string;
  platform: { os: string; arch: string };
  status: string;
  labels: string[];
  agentVersion: string | null;
  lastHeartbeatAt: string | null;
}

export interface McpExtraTool {
  name: string;
  description: string;
}

export interface McpDeps {
  listWorkflows(): Promise<McpWorkflowSummary[]>;
  getWorkflow(id: string): Promise<{ id: string; definition: WorkflowDefinition; status: string } | null>;
  createWorkflow(name: string, definition: WorkflowDefinition): Promise<{ id: string }>;
  updateWorkflow(id: string, definition: WorkflowDefinition): Promise<void>;
  validate(definition: WorkflowDefinition): Promise<{ ok: boolean; errors: { code: string; message: string }[] }>;
  executeWorkflow(workflowId: string): Promise<{ executionId: string; status: string }>;
  getExecution(id: string): Promise<{
    id: string;
    status: string;
    nodeRuns: Array<{ nodeId: string; status: string }>;
  } | null>;
  listExecutions(workflowId: string): Promise<Array<{ id: string; status: string }>>;

  listRunners(): Promise<McpRunnerSummary[]>;
  createRunnerRegistrationToken(opts?: {
    expiresInHours?: number;
    labels?: string[];
  }): Promise<{ registrationToken: string; expiresAt: string }>;

  /** Optional tools (e.g. published chat bots) merged into listTools/callTool. */
  listExtraTools?(): Promise<McpExtraTool[]>;
  callExtraTool?(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
