import type { InstructionContextIR } from './instruction-context-ir.js';

/** Collect rule context paths from node params and upstream Items `json.workingFiles`. */
export function collectContextPaths(
  inputItems: Array<{ json: Record<string, unknown> }>,
  nodeParams: Record<string, unknown>,
): string[] {
  const out = new Set<string>();
  if (Array.isArray(nodeParams.contextPaths)) {
    for (const p of nodeParams.contextPaths) {
      if (typeof p === 'string' && p.trim()) out.add(p.trim());
    }
  }
  for (const item of inputItems) {
    const wf = item.json.workingFiles;
    if (!Array.isArray(wf)) continue;
    for (const entry of wf) {
      if (typeof entry === 'string' && entry.trim()) out.add(entry.trim());
    }
  }
  return [...out];
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/');
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '(?:.*/)?');
  return new RegExp(`^${escaped}$`, 'i');
}

function pathMatchesPattern(filePath: string, pattern: string): boolean {
  const p = filePath.replace(/\\/g, '/');
  return globToRegExp(pattern).test(p);
}

/** Filter instruction contexts by path-scoped globs (P4). */
export function filterContextsByPaths(
  contexts: InstructionContextIR[],
  contextPaths: string[],
): InstructionContextIR[] {
  if (!contextPaths.length) return contexts;
  return contexts.filter((ctx) => {
    if (ctx.loadPhase === 'always' || !ctx.paths?.length) return true;
    return ctx.paths.some((glob) =>
      contextPaths.some((file) => pathMatchesPattern(file, glob)),
    );
  });
}
