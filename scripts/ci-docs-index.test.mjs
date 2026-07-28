#!/usr/bin/env node
/**
 * CI gate: package.json must expose lint:docs-index and ci.yml must invoke it (T-009).
 * Run: node scripts/ci-docs-index.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ciPath = join(repoRoot, '.github', 'workflows', 'ci.yml');
const pkgPath = join(repoRoot, 'package.json');

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

test('package.json defines lint:docs-index script', () => {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.ok(
    pkg.scripts?.['lint:docs-index'],
    'package.json must define scripts["lint:docs-index"]',
  );
  assert.match(
    pkg.scripts['lint:docs-index'],
    /lint-docs-index\.mjs/,
    'lint:docs-index must run scripts/lint-docs-index.mjs',
  );
});

test('ci.yml invokes pnpm lint:docs-index', () => {
  const ci = readFileSync(ciPath, 'utf8');
  assert.match(
    ci,
    /pnpm\s+lint:docs-index/,
    'ci.yml must run pnpm lint:docs-index',
  );
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
