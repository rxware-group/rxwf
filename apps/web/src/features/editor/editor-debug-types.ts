export type BinaryBlobRef = {
  blobId: string;
};

export type BinaryAttachment = {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  ref?: BinaryBlobRef;
};

export type BinaryMap = Record<string, BinaryAttachment>;

export type WorkflowItem = {
  json: Record<string, unknown>;
  binary?: BinaryMap;
};

export type NodeDebugLogEntry = {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
};

export type AgentStreamLogEntry = {
  type: string;
  tool?: string;
  content?: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  error?: string;
  /** Present on `agent_step` chunks (Crew / Agent orchestration). */
  step?: unknown;
  /** Present on `satellite_schema_read` (Output Parser). */
  schema?: unknown;
  /** Present on `satellite_memory_snapshot` (Memory satellite). */
  sessionId?: string;
  messages?: Array<{ role: string; content: string; createdAt?: string }>;
  /** Present on `satellite_knowledge_query` (Knowledge satellite). */
  query?: string;
  knowledgeBaseIds?: string[];
  chunks?: Array<{
    text: string;
    score: number;
    documentName: string;
    knowledgeBaseId: string;
    documentId: string;
    chunkIndex: number;
  }>;
};

export type NodeDebugStatus = 'idle' | 'running' | 'success' | 'failed' | 'waiting';

export type LoopIterationRecord = {
  round: number;
  inputItems: WorkflowItem[];
  outputItems?: WorkflowItem[][];
  durationMs?: number;
  logs?: NodeDebugLogEntry[];
};

export interface NodeDebugState {
  status: NodeDebugStatus;
  /** Frontend-local run id for current debug stream. */
  runId?: string;
  /** Sequence within a run (used for log panel ordering). */
  runSeq?: number;
  itemCount?: number;
  errorMessage?: string;
  errorCode?: string;
  durationMs?: number;
  outputItems?: WorkflowItem[][];
  inputPreview?: WorkflowItem[];
  logs?: NodeDebugLogEntry[];
  agentStream?: AgentStreamLogEntry[];
  /** Per-round input/output for nodes inside a Loop body. */
  loopIterations?: LoopIterationRecord[];
  /** Loop node: number of completed iterations. */
  loopIterationCount?: number;
  /** Loop node: item count per iteration batch on the loop branch. */
  loopBatchItemCount?: number;
}

export type PinDataMap = Record<string, WorkflowItem[]>;

export type NodeOutputPreviewBranch = {
  label: string;
  data: unknown[];
  /** When true, `label` is the round number for `editor.satelliteInvokeRound`. */
  satelliteRound?: boolean;
  /** When true, `label` is the round number for `editor.loopIterationRound`. */
  loopRound?: boolean;
};

export type NodeOutputPreview =
  | { kind: 'single'; data: unknown[] }
  | { kind: 'branches'; branches: NodeOutputPreviewBranch[] };

export function flattenOutputBranches(branches?: WorkflowItem[][]): WorkflowItem[] {
  if (!branches?.length) return [];
  return branches.flat();
}

function formatBinaryAttachmentForDisplay(
  attachment: BinaryAttachment,
): Record<string, unknown> {
  return {
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize ?? (attachment.data ? attachment.data.length : 0),
    ...(attachment.fileName ? { fileName: attachment.fileName } : {}),
    ...(attachment.ref ? { ref: attachment.ref } : {}),
  };
}

function formatBinaryMapForDisplay(binary: BinaryMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, attachment] of Object.entries(binary)) {
    out[key] = formatBinaryAttachmentForDisplay(attachment);
  }
  return out;
}

/** 调试面板展示：去掉执行引擎的 `{ json }` 包装，binary 仅显示元数据摘要 */
export function itemsForDebugDisplay(items: WorkflowItem[]): unknown[] {
  return items.map((item) => {
    const hasJson = item.json !== undefined;
    const hasBinary = item.binary && Object.keys(item.binary).length > 0;
    if (hasJson && !hasBinary) {
      const keys = Object.keys(item);
      if (keys.length === 1 && keys[0] === 'json') {
        return item.json;
      }
    }
    const out: Record<string, unknown> = {};
    if (hasJson) out.json = item.json;
    if (hasBinary) out.binary = formatBinaryMapForDisplay(item.binary!);
    return out;
  });
}
