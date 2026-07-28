#!/usr/bin/env node
/**
 * Adds missing docs markdown paths to docs/INDEX.md frontmatter entries.
 * Usage: node scripts/sync-docs-index.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectDocsMarkdown,
  lintDocsIndex,
  parseIndexFile,
} from './lint-docs-index.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = 'docs/INDEX.md';

/** @param {string} relPath */
function inferCategory(relPath) {
  if (relPath.startsWith('docs/help/zh/nodes/')) return 'help-node';
  if (relPath.startsWith('docs/help/')) return 'help-guide';
  if (relPath.startsWith('docs/test/') || relPath.startsWith('docs/verification/')) return 'test';
  if (relPath.startsWith('docs/workflow/')) return 'workflow';
  if (relPath.startsWith('docs/architecture/')) return 'architecture';
  if (relPath.startsWith('docs/requirements/')) return 'requirements';
  if (relPath.startsWith('docs/superpowers/specs/')) return 'spec';
  if (relPath.startsWith('docs/superpowers/plans/')) return 'requirements';
  if (relPath.startsWith('docs/superpowers/fixtures/')) return 'test';
  if (relPath.startsWith('docs/changelog/')) return 'spec';
  if (/^docs\/adr-/.test(relPath)) return 'adr';
  if (relPath === 'docs/error-codes.md') return 'contract';
  return 'spec';
}

/** @param {string} relPath */
function inferMilestone(relPath) {
  if (relPath.startsWith('docs/help/zh/nodes/')) return '[M-6]';
  if (relPath.includes('M-6')) return '[M-6]';
  if (relPath.startsWith('docs/workflow/tasks/T-1')) return '[M-1]';
  if (relPath.startsWith('docs/test/milestones/M-2')) return '[M-2]';
  if (relPath.startsWith('docs/test/milestones/M-3')) return '[M-3]';
  if (relPath.startsWith('docs/test/milestones/M-4')) return '[M-4]';
  if (relPath.startsWith('docs/test/milestones/M-5')) return '[M-5]';
  return '[M-6]';
}

/** @param {string} relPath */
function inferNodeType(relPath) {
  const match = relPath.match(/^docs\/help\/zh\/nodes\/(.+)\.md$/);
  return match?.[1] ?? null;
}

/** @param {string} relPath */
function titleFromPath(relPath) {
  const base = basename(relPath, '.md');
  if (relPath === 'docs/help/zh/index.md') return '帮助中心首页';
  if (base === 'README') return '目录说明';
  if (relPath.startsWith('docs/workflow/tasks/T-')) return base;
  return base.replace(/[-_]/g, ' ');
}

/** @param {string} relPath */
function formatEntry(relPath) {
  const category = inferCategory(relPath);
  const title = titleFromPath(relPath);
  const milestone = inferMilestone(relPath);
  const nodeType = inferNodeType(relPath);
  const lines = [
    `  - path: ${relPath}`,
    `    title: ${title}`,
    `    category: ${category}`,
  ];
  if (nodeType) {
    lines.push(`    nodeType: ${nodeType}`);
    lines.push('    fr: [FR-06, FR-09]');
  }
  lines.push(`    milestone: ${milestone}`);
  return lines.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const indexAbs = join(REPO_ROOT, INDEX_PATH);
  const content = readFileSync(indexAbs, 'utf8');
  const { frontmatter, entryPaths } = parseIndexFile(content);
  const registered = new Set(entryPaths);
  const allDocs = collectDocsMarkdown(join(REPO_ROOT, 'docs'), REPO_ROOT);
  const missing = allDocs.filter((p) => !registered.has(p)).sort();

  if (missing.length === 0) {
    console.log('sync-docs-index: nothing to add');
    const lint = lintDocsIndex({ repoRoot: REPO_ROOT });
    process.exit(lint.ok ? 0 : 1);
  }

  console.log(`sync-docs-index: ${missing.length} entries to add`);
  if (!write) {
    for (const p of missing.slice(0, 15)) console.log(`  + ${p}`);
    if (missing.length > 15) console.log(`  ... and ${missing.length - 15} more`);
    console.log('Run with --write to apply');
    process.exit(0);
  }

  let updatedFrontmatter = frontmatter.trimEnd();
  updatedFrontmatter = /^updated:/m.test(updatedFrontmatter)
    ? updatedFrontmatter.replace(/^updated:.*$/m, 'updated: 2026-06-21')
    : `${updatedFrontmatter}\nupdated: 2026-06-21`;

  const appended = `${missing.map((p) => formatEntry(p)).join('\n')}\n`;
  updatedFrontmatter = updatedFrontmatter.replace(
    /^entries:\s*\n([\s\S]*)$/m,
    (_, body) => `entries:\n${body.trimEnd()}\n${appended}`.replace(/\n{3,}/g, '\n\n'),
  );

  const updatedContent = content.replace(
    /^---\r?\n[\s\S]*?\r?\n---/,
    `---\n${updatedFrontmatter}\n---`,
  );
  writeFileSync(indexAbs, updatedContent, 'utf8');

  const lint = lintDocsIndex({ repoRoot: REPO_ROOT });
  if (!lint.ok) {
    console.error(
      `lint after sync failed: ${lint.unregistered.length} unregistered, ${lint.orphanEntries.length} orphan`,
    );
    process.exit(1);
  }
  console.log(`sync-docs-index: OK (${lint.registered.length} registered docs)`);
}

main();
