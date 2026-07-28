function parseFiniteMs(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function resolveSkillRunTimeoutMs(
  nodeConfig: Record<string, unknown>,
  env: Record<string, string> | undefined,
): number {
  const fromNode = parseFiniteMs(nodeConfig.timeoutMs);
  const fromEnv = parseFiniteMs(env?.SKILL_RUN_TIMEOUT_MS);
  const raw = fromNode ?? fromEnv ?? 120_000;
  if (raw <= 0) return -1;
  return Math.floor(raw);
}
