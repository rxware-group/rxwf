import { describe, expect, it } from 'vitest';
import { collectContextPaths, filterContextsByPaths } from './context-paths.js';
import type { InstructionContextIR } from './instruction-context-ir.js';

describe('context-paths', () => {
  it('collects workingFiles from items and contextPaths param', () => {
    const paths = collectContextPaths(
      [{ json: { workingFiles: ['src/foo.ts', 'src/bar.ts'] } }],
      { contextPaths: ['docs/*.md'] },
    );
    expect(paths).toContain('src/foo.ts');
    expect(paths).toContain('docs/*.md');
  });

  it('filters contexts by glob paths', () => {
    const contexts: InstructionContextIR[] = [
      {
        relativePath: 'a.md',
        content: 'always',
        sourceFormat: 'rxwf_rules',
        priority: 1,
        loadPhase: 'always',
      },
      {
        relativePath: 'b.md',
        content: 'scoped',
        sourceFormat: 'rxwf_rules',
        priority: 2,
        paths: ['src/*.ts'],
        loadPhase: 'on_request',
      },
    ];
    const filtered = filterContextsByPaths(contexts, ['src/app.ts']);
    expect(filtered.some((c) => c.relativePath === 'a.md')).toBe(true);
    expect(filtered.some((c) => c.relativePath === 'b.md')).toBe(true);
    const miss = filterContextsByPaths(contexts, ['other/x.js']);
    expect(miss.some((c) => c.relativePath === 'b.md')).toBe(false);
  });
});
