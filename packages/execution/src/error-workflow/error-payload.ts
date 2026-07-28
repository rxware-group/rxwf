export interface ErrorWorkflowPayload {
  executionId: string;
  workflowId: string;
  failedNode: string;
  errorMessage: string;
  stack?: string;
  timestamp: string;
}

export const DEFAULT_DEBUG_ERROR_PAYLOAD: ErrorWorkflowPayload = {
  executionId: 'ex-sample',
  workflowId: 'wf-sample',
  failedNode: 'HTTP Request',
  errorMessage: 'Sample error for manual test',
  stack: 'Error: Sample error for manual test',
  timestamp: '2026-05-20T00:00:00.000Z',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseErrorWorkflowPayload(raw: unknown): ErrorWorkflowPayload | null {
  if (!isRecord(raw)) return null;
  const executionId = String(raw.executionId ?? '').trim();
  const workflowId = String(raw.workflowId ?? '').trim();
  const failedNode = String(raw.failedNode ?? '').trim();
  const errorMessage = String(raw.errorMessage ?? '').trim();
  const timestamp = String(raw.timestamp ?? '').trim();
  if (!executionId || !workflowId || !failedNode || !errorMessage || !timestamp) {
    return null;
  }
  return {
    executionId,
    workflowId,
    failedNode,
    errorMessage,
    stack: raw.stack != null ? String(raw.stack) : undefined,
    timestamp,
  };
}

export function resolveErrorPayloadFromEnqueue(
  payload: unknown,
): ErrorWorkflowPayload | null {
  return parseErrorWorkflowPayload(payload);
}

export function resolveErrorPayloadFromNodeConfig(
  config: Record<string, unknown>,
): ErrorWorkflowPayload {
  const fromDebug = parseErrorWorkflowPayload(config._debugSamplePayload);
  if (fromDebug) return fromDebug;
  return { ...DEFAULT_DEBUG_ERROR_PAYLOAD, timestamp: new Date().toISOString() };
}
