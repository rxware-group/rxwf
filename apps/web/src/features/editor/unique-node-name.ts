/** Ensures a display name is unique among existing node names (case-sensitive, trimmed). */
export function ensureUniqueNodeName(
  existingNames: Iterable<string>,
  base: string,
): string {
  const used = new Set(
    [...existingNames].map((n) => n.trim()).filter((n) => n.length > 0),
  );
  const root = base.trim() || 'Node';
  if (!used.has(root)) return root;
  let i = 2;
  while (used.has(`${root} ${i}`)) i++;
  return `${root} ${i}`;
}

export function findDuplicateNodeName(
  nodes: Array<{ id: string; name: string; type: string }>,
  nodeId: string,
): string | null {
  const self = nodes.find((n) => n.id === nodeId);
  if (!self || self.type === 'stickyNote') return null;
  const trimmed = self.name.trim();
  if (!trimmed) return null;
  const dup = nodes.find(
    (n) =>
      n.id !== nodeId &&
      n.type !== 'stickyNote' &&
      n.name.trim() === trimmed,
  );
  return dup ? trimmed : null;
}
