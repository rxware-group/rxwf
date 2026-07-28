import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { Piscina } from 'piscina';
import { AwfError } from '@rxwf/shared';
import type { ExpressionContext } from '../types.js';
import { buildBootstrapData, type SandboxBootstrapData } from './build-globals.js';
import { evaluateJsExpressionDirect } from './run-expression-in-isolate.js';
import type {
  ExpressionWorkerPayload,
  ExpressionWorkerResult,
} from './expression-worker.js';

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

function poolDisabled(): boolean {
  if (process.env.RXWF_EXPR_POOL_DISABLED === '1') return true;
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return true;
  return false;
}

const workerFile = fileURLToPath(
  new URL('../../dist/js-sandbox/expression-worker.js', import.meta.url),
);

let pool: Piscina | null = null;

function getPool(): Piscina {
  if (!pool) {
    const queueLimit = readPositiveInt('RXWF_EXPR_POOL_QUEUE_LIMIT', 0);
    pool = new Piscina({
      filename: workerFile,
      minThreads: readPositiveInt('RXWF_EXPR_POOL_MIN_THREADS', 1),
      maxThreads: readPositiveInt(
        'RXWF_EXPR_POOL_MAX_THREADS',
        Math.max(2, cpus().length - 1),
      ),
      idleTimeout: readPositiveInt('RXWF_EXPR_POOL_IDLE_TIMEOUT_MS', 30_000),
      ...(queueLimit > 0 ? { maxQueue: queueLimit } : {}),
    });
  }
  return pool;
}

function toBootstrapData(context: ExpressionContext): SandboxBootstrapData {
  return buildBootstrapData(context);
}

async function runWorker(payload: ExpressionWorkerPayload): Promise<unknown[]> {
  const msg = (await getPool().run(payload)) as ExpressionWorkerResult;
  if (!msg.ok) {
    throw new AwfError('E1002', msg.message ?? 'Expression evaluation failed');
  }
  return msg.results;
}

export async function evaluateViaPool(
  source: string,
  context: ExpressionContext,
): Promise<unknown> {
  const data = toBootstrapData(context);
  if (poolDisabled()) {
    return evaluateJsExpressionDirect(source, data);
  }
  const results = await runWorker({ op: 'eval', source, data });
  return results[0];
}

export async function evaluateViaPoolBatch(
  sources: string[],
  context: ExpressionContext,
): Promise<unknown[]> {
  const data = toBootstrapData(context);
  if (poolDisabled()) {
    const slot = await import('./run-expression-in-isolate.js');
    const isolateSlot = slot.createIsolateSlot();
    try {
      return await slot.runSourcesInSlot(isolateSlot, data, sources);
    } finally {
      isolateSlot.isolate.dispose();
    }
  }
  return runWorker({ op: 'batch', sources, data });
}

export async function shutdownExpressionPool(): Promise<void> {
  if (pool) {
    await pool.destroy();
    pool = null;
  }
}
