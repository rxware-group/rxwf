import { Piscina } from 'piscina';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { AwfError } from '@rxwf/shared';
import type { ExpressionContext, NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import type { SandboxLogEntry } from './log-collector.js';
import type { SandboxWorkerPayload } from './sandbox-worker.js';

export interface SandboxRunInput {
  code: string;
  inputItems: WorkflowItem[];
  /** Omit or non-positive to disable execution timeout */
  timeoutMs?: number;
  /** Resolved workflow/user/global env */
  env?: Record<string, string>;
  /** Resolved workflow/user/global vars */
  vars?: Record<string, string>;
  /** Preceding nodes' outputs ($nodes) */
  nodes?: NodeOutputEntry[];
  /** Current item index for $json / $binary / $input (default 0) */
  itemIndex?: number;
  /** Maps to `$execution` (same as expression context) */
  execution?: ExpressionContext['execution'];
  /** Maps to `$workflow` (same as expression context) */
  workflow?: ExpressionContext['workflow'];
}

export interface SandboxRunResult {
  items: WorkflowItem[];
  logs: SandboxLogEntry[];
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

const workerFile = fileURLToPath(new URL('../dist/sandbox-worker.js', import.meta.url));

const queueLimit = readPositiveInt('RXWF_SANDBOX_POOL_QUEUE_LIMIT', 0);

const pool = new Piscina({
  filename: workerFile,
  minThreads: readPositiveInt('RXWF_SANDBOX_POOL_MIN_THREADS', 1),
  maxThreads: readPositiveInt('RXWF_SANDBOX_POOL_MAX_THREADS', Math.max(2, cpus().length - 1)),
  idleTimeout: readPositiveInt('RXWF_SANDBOX_POOL_IDLE_TIMEOUT_MS', 30_000),
  ...(queueLimit > 0 ? { maxQueue: queueLimit } : {}),
});

type WorkerResult =
  | { ok: true; items: WorkflowItem[]; logs: SandboxLogEntry[] }
  | { ok: false; message: string };

function toPayload(input: SandboxRunInput): SandboxWorkerPayload {
  return {
    code: input.code,
    inputItems: input.inputItems,
    env: input.env ?? {},
    vars: input.vars ?? {},
    nodes: input.nodes ?? [],
    itemIndex: input.itemIndex,
    execution: input.execution,
    workflow: input.workflow,
  };
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
    const message = err.message;
    return (
      message.includes('Timeout') ||
      message.includes('timed out') ||
      message.includes('Task timed out') ||
      message.includes('aborted')
    );
  }
  return false;
}

export async function runInSandbox(input: SandboxRunInput): Promise<SandboxRunResult> {
  const timeoutMs = input.timeoutMs;
  const runOptions =
    timeoutMs != null && timeoutMs > 0
      ? { signal: AbortSignal.timeout(timeoutMs) }
      : undefined;

  try {
    const msg = (await pool.run(toPayload(input), runOptions)) as WorkerResult;
    if (msg.ok) {
      return { items: msg.items, logs: msg.logs ?? [] };
    }
    throw new AwfError('E2002', msg.message ?? 'Sandbox failed');
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new AwfError('E2002', 'Sandbox execution timed out');
    }
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof AwfError) throw err;
    throw new AwfError('E2002', message);
  }
}

export async function shutdownSandboxPool(): Promise<void> {
  await pool.destroy();
}
