#!/usr/bin/env node
/**
 * Validates that every docs markdown file is registered in docs/INDEX.md entries.
 * Usage:
 *   node scripts/lint-docs-index.mjs
 *   node scripts/lint-docs-index.mjs --check docs/INDEX.md
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_INDEX = 'docs/INDEX.md';

/** Paths excluded from registration requirement (index manifest, templates). */
const EXCLUDED_PATHS = new Set([
  'docs/INDEX.md',
]);

/**
 * @param {string} frontmatter
 * @returns {string[]}
 */
export function parseIndexEntryPaths(frontmatter) {
  const paths = [];
  let inEntries = false;

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trimEnd();
    if (/^entries:\s*$/.test(line)) {
      inEntries = true;
      continue;
    }
    if (!inEntries) continue;

    const listItem = line.match(/^\s*-\s*path:\s*(.+)$/);
    if (listItem) {
      paths.push(normalizePath(listItem[1].trim()));
      continue;
    }

    const nested = line.match(/^\s+path:\s*(.+)$/);
    if (nested) {
      paths.push(normalizePath(nested[1].trim()));
      continue;
    }

    if (/^\S/.test(line) && !line.startsWith('-')) {
      inEntries = false;
    }
  }

  return paths;
}

/**
 * @param {string} content
 * @returns {{ frontmatter: string, entryPaths: string[] }}
 */
export function parseIndexFile(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { frontmatter: '', entryPaths: [] };
  }
  const frontmatter = match[1];
  return { frontmatter, entryPaths: parseIndexEntryPaths(frontmatter) };
}

/**
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * @param {string} dir
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function collectDocsMarkdown(dir, repoRoot) {
  const results = [];

  function walk(absDir) {
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!name.endsWith('.md')) continue;
      const rel = normalizePath(relative(repoRoot, abs));
      if (EXCLUDED_PATHS.has(rel)) continue;
      results.push(rel);
    }
  }

  walk(dir);
  results.sort();
  return results;
}

/**
 * @param {{ repoRoot?: string, indexPath?: string, docsDir?: string }} [options]
 * @returns {{ ok: boolean, unregistered: string[], orphanEntries: string[], registered: string[] }}
 */
export function lintDocsIndex(options = {}) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = options.repoRoot ?? join(scriptDir, '..');
  const indexRel = normalizePath(options.indexPath ?? DEFAULT_INDEX);
  const docsRel = normalizePath(options.docsDir ?? 'docs');
  const indexAbs = join(repoRoot, indexRel);
  const docsAbs = join(repoRoot, docsRel);

  let entryPaths = [];
  try {
    const indexContent = readFileSync(indexAbs, 'utf8');
    entryPaths = parseIndexFile(indexContent).entryPaths;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return {
        ok: false,
        unregistered: [],
        orphanEntries: [],
        registered: [],
        error: `INDEX not found: ${indexRel}`,
      };
    }
    throw err;
  }

  const registeredSet = new Set(entryPaths);
  const docFiles = collectDocsMarkdown(docsAbs, repoRoot);
  const unregistered = docFiles.filter((p) => !registeredSet.has(p));
  const docSet = new Set(docFiles);
  const orphanEntries = entryPaths.filter((p) => !docSet.has(p) && !EXCLUDED_PATHS.has(p));

  return {
    ok: unregistered.length === 0 && orphanEntries.length === 0,
    unregistered,
    orphanEntries,
    registered: docFiles.filter((p) => registeredSet.has(p)),
  };
}

function printResult(result) {
  if (result.error) {
    console.error(`lint-docs-index: ${result.error}`);
    return 1;
  }

  if (result.ok) {
    console.log(
      `lint-docs-index: OK (${result.registered.length} registered docs)`,
    );
    return 0;
  }

  if (result.unregistered.length > 0) {
    console.error(
      `lint-docs-index: ${result.unregistered.length} unregistered doc(s):`,
    );
    for (const p of result.unregistered) {
      console.error(`  - ${p}`);
    }
  }

  if (result.orphanEntries.length > 0) {
    console.error(
      `lint-docs-index: ${result.orphanEntries.length} orphan INDEX entr(ies):`,
    );
    for (const p of result.orphanEntries) {
      console.error(`  - ${p}`);
    }
  }

  return 1;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check' && argv[i + 1]) {
      options.indexPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--docs-dir' && argv[i + 1]) {
      options.docsDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--root' && argv[i + 1]) {
      options.repoRoot = argv[i + 1];
      i += 1;
    }
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const cliOptions = parseArgs(argv);
  const result = lintDocsIndex({
    repoRoot: cliOptions.repoRoot ?? process.cwd(),
    indexPath: cliOptions.indexPath,
    docsDir: cliOptions.docsDir,
  });
  process.exit(printResult(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
