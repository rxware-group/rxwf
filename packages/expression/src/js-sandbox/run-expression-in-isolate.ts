import ivm from 'isolated-vm';
import { AwfError } from '@rxwf/shared';
import { BOOTSTRAP_SCRIPT, type SandboxBootstrapData } from './build-globals.js';
import { wrapExpressionSource } from './wrap-expression-source.js';

const MEMORY_LIMIT_MB = 32;

export interface IsolateSlot {
  isolate: ivm.Isolate;
  context: ivm.Context;
  bootstrapScript: ivm.Script;
}

export function createIsolateSlot(): IsolateSlot {
  const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
  const context = isolate.createContextSync();
  const jail = context.global;
  jail.setSync('global', jail.derefInto());
  const bootstrapScript = isolate.compileScriptSync(BOOTSTRAP_SCRIPT);
  return { isolate, context, bootstrapScript };
}

export async function resetIsolateContext(
  slot: IsolateSlot,
  data: SandboxBootstrapData,
): Promise<void> {
  const jail = slot.context.global;
  await jail.set('__bootstrapData', new ivm.ExternalCopy(data).copyInto());
  await slot.bootstrapScript.run(slot.context);
}

export async function runSourcesInSlot(
  slot: IsolateSlot,
  data: SandboxBootstrapData,
  sources: string[],
): Promise<unknown[]> {
  await resetIsolateContext(slot, data);
  const results: unknown[] = [];
  for (const source of sources) {
    const script = await slot.isolate.compileScript(wrapExpressionSource(source));
    results.push(await script.run(slot.context, { promise: true, copy: true }));
  }
  return results;
}

export async function evaluateJsExpressionDirect(
  source: string,
  data: SandboxBootstrapData,
): Promise<unknown> {
  const slot = createIsolateSlot();
  try {
    const [result] = await runSourcesInSlot(slot, data, [source]);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AwfError('E1002', message);
  } finally {
    slot.isolate.dispose();
  }
}
