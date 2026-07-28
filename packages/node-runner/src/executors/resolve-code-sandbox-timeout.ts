function parseFiniteMs(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function resolveCodeSandboxTimeoutMs(
  nodeConfig: Record<string, unknown>,
  env: Record<string, string> | undefined,
): number {
  const fromNode = parseFiniteMs(nodeConfig.timeoutMs);
  const fromEnv = parseFiniteMs(
    env?.RXWF_SANDBOX_CODE_TIMEOUT_MS ?? env?.SANDBOX_CODE_TIMEOUT_MS,
  );
  const raw = fromNode ?? fromEnv ?? -1;
  if (raw <= 0) return -1;
  return Math.floor(raw);
}
