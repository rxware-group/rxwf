export interface PathOutsideScanRootsOptions {
  path?: string;
  cwd?: string;
}

export function formatPathOutsideScanRootsMessage(
  scanRoots: string[] | undefined,
  options: PathOutsideScanRootsOptions = {},
): string {
  const roots = (scanRoots ?? []).map((r) => r.trim()).filter(Boolean);
  const rootsLabel = roots.length > 0 ? roots.join('; ') : '(none configured)';
  const parts = [`Path outside scanRoots. Allowed roots: ${rootsLabel}`];
  if (options.path) {
    parts.push(`Path: ${options.path}`);
  }
  if (options.cwd) {
    parts.push(`Cwd: ${options.cwd}`);
  }
  return parts.join('. ');
}
