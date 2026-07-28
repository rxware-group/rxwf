export function normalizeKnowledgeBaseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
