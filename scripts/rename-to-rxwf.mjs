#!/usr/bin/env node
/**
 * Ordered rebrand: any-workflow/AWF/awf → rx-workflow/RXWF/rxwf
 * Usage:
 *   node scripts/rename-to-rxwf.mjs --dry-run
 *   node scripts/rename-to-rxwf.mjs
 */
import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const dryRun = process.argv.includes('--dry-run');

const SCAN_ROOTS = [
  'packages',
  'apps',
  'deploy',
  'docs',
  '.github',
  'scripts',
];
const ROOT_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.gitignore',
];

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  'data',
  'coverage',
]);

/** Order matters — longest / most specific first */
const REPLACEMENTS = [
  ['@any-workflow/', '@rxwf/'],
  ['ghcr.io/any-workflow/', 'ghcr.io/rxwf/'],
  ['awf-runner.json', 'rxwf-runner.json'],
  ['awf-runner', 'rxwf-runner'],
  ['AWF_EXPR_DRAG_MIME', 'RXWF_EXPR_DRAG_MIME'],
  ['AWF_JSON', 'RXWF_JSON'],
  ['AWF_', 'RXWF_'],
  ['--awf-', '--rxwf-'],
  ['x-awf-', 'x-rxwf-'],
  ['.awf/', '.rxwf/'],
  ['".awf"', '".rxwf"'],
  ["'.awf'", "'.rxwf'"],
  ['join(repoRoot, ".awf")', 'join(repoRoot, ".rxwf")'],
  ['awf.db', 'rxwf.db'],
  ['awf-knowledge-jobs', 'rxwf-knowledge-jobs'],
  ['awf-pg-data', 'rxwf-pg-data'],
  ['awf-e2e', 'rxwf-e2e'],
  ['awf-form-field', 'rxwf-form-field'],
  ['awf-modal', 'rxwf-modal'],
  ['awf-tooltip', 'rxwf-tooltip'],
  ['awf-loading', 'rxwf-loading'],
  ['awf-scroll', 'rxwf-scroll'],
  ['awf-embed:', 'rxwf-embed:'],
  ["'awf.", "'rxwf."],
  ['"awf.', '"rxwf.'],
  ['postgres://awf:awf@localhost:5432/awf', 'postgres://rxwf:rxwf@localhost:5432/rxwf'],
  ['postgres://awf:awf@', 'postgres://rxwf:rxwf@'],
  ['POSTGRES_USER: awf', 'POSTGRES_USER: rxwf'],
  ['POSTGRES_PASSWORD: awf', 'POSTGRES_PASSWORD: rxwf'],
  ['POSTGRES_DB: awf', 'POSTGRES_DB: rxwf'],
  ['pg_isready -U awf', 'pg_isready -U rxwf'],
  [':-awf}', ':-rxwf}'],
  ['any-workflow', 'rx-workflow'],
  ['"awf": "./dist/index.js"', '"rxwf": "./dist/index.js"'],
  ['"awf": "awf"', '"rxwf": "rxwf"'],
  ['program.name("awf")', 'program.name("rxwf")'],
  ['any-workflow CLI', 'RX-Workflow CLI'],
  ['自动化工作流系统', 'RX-Workflow'],
];

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml',
  '.md', '.css', '.html', '.py', '.txt', '.example', '.schema.json',
]);

async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

function shouldProcessFile(filePath) {
  if (filePath.endsWith('rename-to-rxwf.mjs')) return false;
  if (filePath.endsWith('lint-no-legacy-names.mjs')) return false;
  if (filePath.endsWith('2026-05-30-rx-workflow-rename-design.md')) return false;
  if (filePath.endsWith('2026-05-30-rx-workflow-rename.md')) return false;
  const dot = filePath.lastIndexOf('.');
  const ext = dot >= 0 ? filePath.slice(dot) : '';
  return TEXT_EXT.has(ext) || filePath.endsWith('Dockerfile') || !ext;
}

async function processFile(absPath) {
  if (!shouldProcessFile(absPath)) return 0;
  const before = await readFile(absPath, 'utf8');
  const after = applyReplacements(before);
  if (after === before) return 0;
  if (!dryRun) await writeFile(absPath, after, 'utf8');
  console.log(`${dryRun ? '[dry-run] ' : ''}updated ${relative(repoRoot, absPath)}`);
  return 1;
}

const FILE_RENAMES = [
  ['scripts/awf-migrate.mjs', 'scripts/rxwf-migrate.mjs'],
  [
    'packages/runner-agent/awf-runner.json.example',
    'packages/runner-agent/rxwf-runner.json.example',
  ],
];

async function main() {
  let changed = 0;
  for (const root of SCAN_ROOTS) {
    const abs = join(repoRoot, root);
    try {
      await stat(abs);
    } catch {
      continue;
    }
    for await (const file of walkFiles(abs)) {
      changed += await processFile(file);
    }
  }
  for (const rel of ROOT_FILES) {
    const abs = join(repoRoot, rel);
    try {
      await stat(abs);
      changed += await processFile(abs);
    } catch {
      /* skip missing */
    }
  }
  for (const [from, to] of FILE_RENAMES) {
    const fromAbs = join(repoRoot, from);
    const toAbs = join(repoRoot, to);
    try {
      await stat(fromAbs);
    } catch {
      console.warn(`skip rename (missing): ${from}`);
      continue;
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}rename ${from} → ${to}`);
    if (!dryRun) await rename(fromAbs, toAbs);
    changed += 1;
  }
  console.log(`\nDone. ${changed} file(s) touched.${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
