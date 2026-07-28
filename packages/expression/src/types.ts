import type { WorkflowItem } from '@rxwf/shared';

/** One preceding node's main-branch output for expression / Code context */
export interface NodeOutputEntry {
  name: string;
  /** First main-branch item json (shortcut) */
  json: Record<string, unknown>;
  /** Full main-branch items from that node */
  items: WorkflowItem[];
}

/** @deprecated Use NodeOutputEntry — kept for gradual migration in callers */
export type NodeExpressionData = Pick<NodeOutputEntry, 'json'>;

export interface ExecutionMeta {
  id: string;
  mode: string;
  environment: string;
  startedAt?: string;
}

export interface WorkflowMeta {
  id: string;
  name: string;
  versionId?: string;
}

export interface ExpressionContext {
  /** Current item json ($json) */
  json: Record<string, unknown>;
  /** Current item binary ($binary) */
  binary?: WorkflowItem['binary'];
  /** Full input items array ($input) */
  input?: WorkflowItem[];
  /** Index of current item in input */
  itemIndex?: number;
  env?: Record<string, string | number | boolean>;
  vars?: Record<string, string>;
  /** Preceding nodes' outputs ($nodes) */
  nodes?: NodeOutputEntry[];
  execution?: ExecutionMeta;
  workflow?: WorkflowMeta;
  /** Session-fixed ISO timestamp for $now; computed at open if omitted */
  nowIso?: string;
  /** Session-fixed ISO timestamp for $today (local midnight); computed at open if omitted */
  todayIso?: string;
}
