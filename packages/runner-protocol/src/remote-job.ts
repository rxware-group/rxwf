import type { WorkflowItem } from '@rxwf/shared';

export interface RemoteNodeRunJob {
  jobId: string;
  executionId: string;
  nodeRunId: string;
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  inputItems: WorkflowItem[];
  inputBranches?: WorkflowItem[][];
  mode: 'production' | 'manual' | 'partial';
  workflowSettings: Record<string, unknown>;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  timeoutMs: number;
}

export interface RemoteNodeRunResult {
  jobId: string;
  status: 'success' | 'failed' | 'skipped';
  outputItems?: WorkflowItem[][];
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  durationMs: number;
}
