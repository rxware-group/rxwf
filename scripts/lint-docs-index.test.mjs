#!/usr/bin/env node
/**
 * Unit tests for scripts/lint-docs-index.mjs (T-005).
 * Run: node scripts/lint-docs-index.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintDocsIndex } from './lint-docs-index.mjs';

const scriptPath = fileURLToPath(new URL('./lint-docs-index.mjs', import.meta.url));

function writeIndex(root, entries) {
  const body = entries
    .map((e) => `  - path: ${e.path}\n    title: ${e.title ?? e.path}`)
    .join('\n');
  const content = `---
version: 1
updated: 2026-06-18
entries:
${body}
---
# Docs Index
`;
  writeFileSync(join(root, 'docs', 'INDEX.md'), content, 'utf8');
}

function createFixture(entries, extraFiles = {}) {
  const root = mkdtempSync(join(tmpdir(), 'lint-docs-index-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeIndex(root, entries);
  for (const [rel, content] of Object.entries(extraFiles)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  return root;
}

function runCli(root, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err);
    failed += 1;
  }
}

test('unregistered docs/foo.md causes exit 1', () => {
  const root = createFixture([{ path: 'docs/registered.md' }], {
    'docs/registered.md': '# Registered\n',
    'docs/foo.md': '# Foo\n',
  });

  const result = lintDocsIndex({ repoRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.unregistered.includes('docs/foo.md'));

  const cli = runCli(root);
  assert.equal(cli.status, 1);
  assert.match(cli.stderr + cli.stdout, /docs\/foo\.md/);
});

test('registered INDEX entries cause exit 0', () => {
  const root = createFixture([{ path: 'docs/registered.md' }], {
    'docs/registered.md': '# Registered\n',
  });

  const result = lintDocsIndex({ repoRoot: root });
  assert.equal(result.ok, true);
  assert.deepEqual(result.unregistered, []);

  const cli = runCli(root);
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /OK|ok/i);
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
