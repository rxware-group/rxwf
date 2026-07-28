#!/usr/bin/env node
/**
 * AC-002 structure tests for docs/README.md
 * Run: node docs/README.test.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(join(root, 'README.md'), 'utf8');

function sectionAfter(heading) {
  const re = new RegExp(`^## ${heading}\\s*$`, 'm');
  const match = re.exec(readme);
  if (!match) return '';
  const rest = readme.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('AC-002: README has 分类目录 section', () => {
  assert.match(readme, /^## 分类目录/m);
});

test('AC-002: README has 维护规则 section', () => {
  assert.match(readme, /^## 维护规则/m);
});

test('AC-002: 分类目录 has categorized subsections', () => {
  const catalog = sectionAfter('分类目录');
  assert.match(catalog, /^### /m, 'expected at least one ### subsection');
});

test('AC-002: catalog rows link files with one-line summaries', () => {
  const catalog = sectionAfter('分类目录');
  const rows =
    catalog.match(/^\| \[[^\]]+\]\([^)]+\)[^|]*\|[^|\n]+ \|$/gm) ?? [];
  assert.ok(rows.length >= 30, `expected >= 30 catalog rows, got ${rows.length}`);
});

test('AC-002: 维护规则 references INDEX.md registration', () => {
  const maintenance = sectionAfter('维护规则');
  assert.match(maintenance, /INDEX\.md/);
  assert.match(maintenance, /登记|同步/);
});
