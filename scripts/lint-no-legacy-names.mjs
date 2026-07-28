#!/usr/bin/env node
/**
 * Fail if legacy any-workflow / AWF / awf names remain in scanned paths.
 * Usage: node scripts/lint-no-legacy-names.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');

const SCAN_ROOTS = [
  'packages',
  'apps',
  'deploy',
  'docs',
  '.github',
  'scripts',
];
const ROOT_FILES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', '.gitignore'];

const SKIP_DIR = new Set(['node_modules', 'dist', '.git', 'data', 'coverage', '.turbo']);

const FORBIDDEN = [
  /@any-workflow\//,
  /\bany-workflow\b/,
  /\bAny-Workflow\b/,
  /\bAny Workflow\b/,
  /ghcr\.io\/any-workflow\//,
  /AWF_/,
  /AWF_JSON/,
  /\bawf-runner\b/,
  /\bawf\.db\b/,
  /--awf-/,
  /x-awf-/,
  /\.awf[/'"\\]/,
  /\bawf-knowledge-jobs\b/,
  /\bawf-standard\b/,
  /\bawf-execution-jobs\b/,
  /\bawf-node-glyph\b/,
  /\bawf deps\b/,
  /\bawf start\b/,
  /pnpm awf\b/,
  /@acme\/awf-/,
];

const ALLOWLIST = [
  /lint-no-legacy-names\.mjs$/,
  /rename-to-rxwf\.mjs$/,
  /2026-05-30-rx-workflow-rename-design\.md$/,
  /2026-05-30-rx-workflow-rename\.md$/,
  /UPGRADE-rx-workflow\.md$/,
  /rename-workspace-to-rx-workflow\.ps1$/,
];

async function* walkFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

function isAllowed(relPath) {
  return ALLOWLIST.some((re) => re.test(relPath));
}

async function scanFile(absPath) {
  const rel = relative(repoRoot, absPath).replace(/\\/g, '/');
  if (isAllowed(rel)) return [];
  let content;
  try {
    content = await readFile(absPath, 'utf8');
  } catch {
    return [];
  }
  if (content.includes('\0')) return [];
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of FORBIDDEN) {
      if (re.test(lines[i])) {
        hits.push({ file: rel, line: i + 1, text: lines[i].trim(), rule: re.source });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  const allHits = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(repoRoot, root);
    try {
      await stat(abs);
    } catch {
      continue;
    }
    for await (const file of walkFiles(abs)) {
      allHits.push(...(await scanFile(file)));
    }
  }
  for (const rel of ROOT_FILES) {
    const abs = join(repoRoot, rel);
    try {
      await stat(abs);
      allHits.push(...(await scanFile(abs)));
    } catch {
      /* skip */
    }
  }
  if (allHits.length === 0) {
    console.log('lint-no-legacy-names: OK (no forbidden patterns)');
    return;
  }
  console.error(`lint-no-legacy-names: ${allHits.length} violation(s):\n`);
  for (const h of allHits.slice(0, 50)) {
    console.error(`  ${h.file}:${h.line}  [${h.rule}]`);
    console.error(`    ${h.text}\n`);
  }
  if (allHits.length > 50) {
    console.error(`  ... and ${allHits.length - 50} more`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
