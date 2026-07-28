import { createLogCollector } from './log-collector.js';
import { buildCodeSandboxGlobals, type CodeSandboxBootstrapInput } from './sandbox-globals.js';
import { normalizeSandboxReturnValue } from './sandbox-item-utils.js';

export interface SandboxWorkerPayload extends CodeSandboxBootstrapInput {
  code: string;
}

function runCode(data: SandboxWorkerPayload) {
  const log = createLogCollector({ maxEntries: 100, maxMessageLen: 4096 });
  const $log = {
    debug: (m: unknown) => log.debug(m),
    info: (m: unknown) => log.info(m),
    warn: (m: unknown) => log.warn(m),
    error: (m: unknown) => log.error(m),
  };
  const {
    $json,
    $binary,
    $env,
    $vars,
    $itemIndex,
    $execution,
    $workflow,
    $input,
    $nodes,
  } = buildCodeSandboxGlobals(data);
  const fn = new Function(
    '$json',
    '$binary',
    '$env',
    '$vars',
    '$itemIndex',
    '$execution',
    '$workflow',
    '$input',
    '$nodes',
    '$log',
    data.code,
  );
  const raw = fn(
    $json,
    $binary,
    $env,
    $vars,
    $itemIndex,
    $execution,
    $workflow,
    $input,
    $nodes,
    $log,
  );
  const items = normalizeSandboxReturnValue(raw);
  return { ok: true as const, items, logs: log.entries() };
}

export default function sandboxWorker(payload: SandboxWorkerPayload) {
  try {
    return runCode(payload);
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
