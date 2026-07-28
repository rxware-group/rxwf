export function normalizeExecuteCommandArgs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => String(entry ?? ''));
}
