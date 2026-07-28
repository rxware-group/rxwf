export function resolveEnvLayers(layers: {
  global: Record<string, string>;
  user: Record<string, string>;
  workflow: Record<string, string>;
}): Record<string, string> {
  return { ...layers.global, ...layers.user, ...layers.workflow };
}

export function recordsToMap(
  records: Array<{ key: string; value: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of records) {
    out[r.key] = r.value;
  }
  return out;
}
