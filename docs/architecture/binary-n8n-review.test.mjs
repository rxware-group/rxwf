#!/usr/bin/env node
/**
 * AC-045 / T-100: n8n Binary benchmark review gate (B-2).
 * b6ImplementationGate cleared after B-6 user confirmation (T-103).
 * Run: node docs/architecture/binary-n8n-review.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const REVIEW_PATH = join(root, 'binary-n8n-review.md');

const REQUIRED_COMPARISON_IDS = [
  'N8N-01',
  'N8N-02',
  'N8N-03',
  'N8N-04',
  'N8N-05',
  'N8N-06',
];

const ALLOWED_GAP_CONCLUSIONS = new Set([
  '对齐',
  '部分对齐',
  'rxwf 缺失',
  '待 B-6 确认',
]);

const REQUIRED_SECTIONS = [
  '## 1. 目的与范围',
  '## 2. n8n 参考来源',
  '## 3. n8n 对标对照表',
  '## 4. 差距摘要（供 B-4 / B-5）',
  '## 5. B-2 审查门禁结论',
];

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

export function parseComparisonRows(content) {
  const sectionMatch = content.match(/^## 3\. n8n 对标对照表\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| N8N-')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 5) continue;
    rows.push({
      id: cells[0],
      domain: cells[1],
      conclusion: cells[4],
    });
  }
  return rows;
}

export function validateBinaryN8nReview(docPath = REVIEW_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      b2N8nReviewGate: 'blocked',
      b6ImplementationGate: 'blocked',
      errors: ['binary-n8n-review.md missing — B-2 n8n review gate blocked (AC-045 / T-100)'],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-045') errors.push('frontmatter trace must be AC-045');
    if (fm.task !== 'T-100') errors.push('frontmatter task must be T-100');
    if (!fm.reviewDate) errors.push('frontmatter reviewDate required');
    if (!['approved', 'cleared'].includes(fm.status ?? '')) {
      errors.push(`frontmatter status must be approved or cleared, got ${fm.status}`);
    }
    if (fm.b2N8nReviewGate !== 'cleared') {
      errors.push(`frontmatter b2N8nReviewGate must be cleared, got ${fm.b2N8nReviewGate}`);
    }
    if (fm.b6ImplementationGate !== 'cleared') {
      errors.push(
        `frontmatter b6ImplementationGate must be cleared after B-6, got ${fm.b6ImplementationGate}`,
      );
    }
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  const rows = parseComparisonRows(content);
  const foundIds = new Set(rows.map((r) => r.id));
  for (const id of REQUIRED_COMPARISON_IDS) {
    if (!foundIds.has(id)) errors.push(`comparison row missing: ${id}`);
  }

  for (const row of rows) {
    if (!ALLOWED_GAP_CONCLUSIONS.has(row.conclusion)) {
      errors.push(
        `${row.id} conclusion must be one of ${[...ALLOWED_GAP_CONCLUSIONS].join(', ')}`,
      );
    }
  }

  const requiredRefs = [
    'docs.n8n.io',
    'architecture.md',
    '§9',
    '2026-06-03-workflow-binary-support-design.md',
    'IBinaryData',
  ];
  for (const ref of requiredRefs) {
    if (!content.includes(ref)) errors.push(`must reference: ${ref}`);
  }

  const b2Gate = fm?.b2N8nReviewGate ?? 'blocked';
  const b6Gate = fm?.b6ImplementationGate ?? 'blocked';
  return {
    ok: errors.length === 0,
    b2N8nReviewGate: b2Gate,
    b6ImplementationGate: b6Gate,
    errors,
  };
}

test('AC-045 / T-100: n8n review document clears B-2 gate', () => {
  const result = validateBinaryN8nReview();
  assert.equal(
    result.b2N8nReviewGate,
    'cleared',
    '未完成 n8n 对标审查应阻塞 B-2 门禁',
  );
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-045 / T-100: all required n8n comparison domains documented', () => {
  const content = readFileSync(REVIEW_PATH, 'utf8');
  const rows = parseComparisonRows(content);
  const ids = rows.map((r) => r.id);
  for (const id of REQUIRED_COMPARISON_IDS) {
    assert.ok(ids.includes(id), `missing comparison id ${id}`);
  }
  assert.ok(rows.length >= REQUIRED_COMPARISON_IDS.length);
});

test('AC-045 / T-100: B-6 passed — b6ImplementationGate cleared', () => {
  const result = validateBinaryN8nReview();
  assert.equal(
    result.b6ImplementationGate,
    'cleared',
    'B-6 确认后 binary 实现门禁须 cleared',
  );
  const content = readFileSync(REVIEW_PATH, 'utf8');
  const fm = parseFrontmatter(content);
  assert.equal(fm?.b6ImplementationGate, 'cleared');
});
