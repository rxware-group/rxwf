export interface ToolWorkflowTargetInfo {
  exists: boolean;
  published: boolean;
  exposeAsTool: boolean;
}

export interface ToolWorkflowValidationError {
  code: string;
  message: string;
  nodeId?: string;
}

export function validateToolWorkflowTarget(
  info: ToolWorkflowTargetInfo,
  nodeId?: string,
): ToolWorkflowValidationError | null {
  if (!info.exists) {
    return {
      code: 'E1022',
      message: 'Workflow Tool target workflow not found',
      nodeId,
    };
  }
  if (!info.published) {
    return {
      code: 'E1023',
      message: 'Workflow Tool target workflow must be published',
      nodeId,
    };
  }
  if (!info.exposeAsTool) {
    return {
      code: 'E1024',
      message: 'Workflow Tool target must have exposeAsTool enabled on published version',
      nodeId,
    };
  }
  return null;
}
