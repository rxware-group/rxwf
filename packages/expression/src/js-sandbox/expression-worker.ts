import type { SandboxBootstrapData } from './build-globals.js';
import {
  createIsolateSlot,
  runSourcesInSlot,
  type IsolateSlot,
} from './run-expression-in-isolate.js';

export type ExpressionWorkerPayload =
  | { op: 'eval'; source: string; data: SandboxBootstrapData }
  | { op: 'batch'; sources: string[]; data: SandboxBootstrapData };

export type ExpressionWorkerResult =
  | { ok: true; results: unknown[] }
  | { ok: false; message: string };

let slot: IsolateSlot | null = null;

function getSlot(): IsolateSlot {
  if (!slot) {
    slot = createIsolateSlot();
  }
  return slot;
}

export default async function expressionWorker(
  payload: ExpressionWorkerPayload,
): Promise<ExpressionWorkerResult> {
  try {
    const active = getSlot();
    if (payload.op === 'eval') {
      const results = await runSourcesInSlot(active, payload.data, [payload.source]);
      return { ok: true, results };
    }
    const results = await runSourcesInSlot(active, payload.data, payload.sources);
    return { ok: true, results };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
