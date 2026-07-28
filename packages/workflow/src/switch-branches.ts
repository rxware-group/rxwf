export type SwitchBranch = {
  id: string;
  label: string;
  condition: string;
};

export function createSwitchBranch(index: number): SwitchBranch {
  return {
    id: crypto.randomUUID(),
    label: `端口${index + 1}`,
    condition: index === 0 ? '{{ true }}' : '{{ false }}',
  };
}

export function defaultSwitchParameters(): Record<string, unknown> {
  return { branches: [createSwitchBranch(0)] };
}

export function parseSwitchBranches(
  parameters?: Record<string, unknown>,
): SwitchBranch[] {
  const raw = parameters?.branches;
  if (!Array.isArray(raw)) return [];
  const out: SwitchBranch[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? '').trim();
    if (!id) continue;
    out.push({
      id,
      label: String(r.label ?? '').trim() || `端口${out.length + 1}`,
      condition: String(r.condition ?? '').trim(),
    });
  }
  return out;
}

/** Maps connection handle / persisted outputIndex to executor branch index. */
export function switchBranchIndex(
  parameters: Record<string, unknown> | undefined,
  handle?: string | null,
  outputIndex?: number,
): number {
  const branches = parseSwitchBranches(parameters);
  if (branches.length === 0) return 0;

  if (typeof outputIndex === 'number' && outputIndex >= 0 && outputIndex < branches.length) {
    return outputIndex;
  }

  const h = handle ?? 'main';
  if (!h || h === 'main') return 0;

  const byId = branches.findIndex((b) => b.id === h);
  if (byId >= 0) return byId;

  const n = Number(h);
  if (!Number.isNaN(n) && n >= 0 && n < branches.length) return n;

  return 0;
}
