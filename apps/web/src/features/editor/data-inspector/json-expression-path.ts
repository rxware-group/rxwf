/** Drop leading item-index segment when JSON root is a multi-item array. */
export function toExpressionPath(path: string[], itemCount: number): string[] {
  if (itemCount <= 0 || path.length === 0) return path;
  const head = path[0];
  if (/^\d+$/.test(head)) {
    const idx = Number(head);
    if (idx >= 0 && idx < itemCount) {
      return path.slice(1);
    }
  }
  return path;
}
