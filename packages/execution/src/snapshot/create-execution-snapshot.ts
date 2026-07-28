export interface WorkflowDefinitionSnapshot {
  nodes: unknown[];
  edges: unknown[];
  settings?: Record<string, unknown>;
}

export interface ExecutionSnapshotRecord {
  workflowId: string;
  workflowVersionId: string;
  definition_snapshot: WorkflowDefinitionSnapshot;
  trigger_type: string;
}

export function createExecutionSnapshot(input: {
  workflowId: string;
  workflowVersionId: string;
  definition: WorkflowDefinitionSnapshot;
  triggerType: string;
}): ExecutionSnapshotRecord {
  return {
    workflowId: input.workflowId,
    workflowVersionId: input.workflowVersionId,
    definition_snapshot: structuredClone(input.definition),
    trigger_type: input.triggerType,
  };
}
