/** Bump patch segment of semver label; defaults to 1.0.0 when missing or invalid. */
export function nextSemverLabel(current: string | null | undefined): string {
  if (!current?.trim()) return '1.0.0';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current.trim());
  if (!match) return '1.0.0';
  const patch = Number(match[3]) + 1;
  return `${match[1]}.${match[2]}.${patch}`;
}

export function normalizeSemverLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  if (!trimmed) return '1.0.0';
  if (/^\d+\.\d+\.\d+$/.test(trimmed)) return trimmed;
  throw new Error(`Invalid semver label: ${label}`);
}
