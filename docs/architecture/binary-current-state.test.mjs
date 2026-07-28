#!/usr/bin/env node
/**
 * AC-045 / T-099: Binary B-1 current-state capability matrix gate.
 * Run: node docs/architecture/binary-current-state.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(root, 'binary-current-state.md');

const REQUIRED_MATRIX_IDS = [
  'BIN-01',
  'BIN-02',
  'BIN-03',
  'BIN-04',
  'BIN-05',
  'BIN-06',
  'BIN-07',
  'BIN-08',
  'BIN-09',
  'BIN-10',
  'BIN-11',
  'BIN-12',
  'BIN-13',
  'BIN-14',
  'BIN-15',
  'BIN-16',
  'BIN-17',
  'BIN-18',
  'BIN-19',
  'BIN-20',
  'BIN-21',
];

const ALLOWED_STATUSES = new Set(['已实现', '部分实现', '未实现', '仅类型']);

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

export function parseMatrixRows(content) {
  const sectionMatch = content.match(/^## 3\. 能力矩阵\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| BIN-')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    rows.push({
      id: cells[0],
      domain: cells[1],
      capability: cells[2],
      status: cells[3],
    });
  }
  return rows;
}

export function validateBinaryCurrentState(docPath = SNAPSHOT_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      m5BinaryPlanGate: 'blocked',
      errors: ['binary-current-state.md missing — M-5 B-1 snapshot blocked (AC-045)'],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-045') errors.push('frontmatter trace must be AC-045');
    if (!fm.b1SnapshotDate) errors.push('frontmatter b1SnapshotDate required');
    if (!['approved', 'draft'].includes(fm.status ?? '')) {
      errors.push(`frontmatter status must be approved or draft, got ${fm.status}`);
    }
    if (!['cleared', 'blocked'].includes(fm.m5BinaryPlanGate ?? '')) {
      errors.push('frontmatter m5BinaryPlanGate must be cleared or blocked');
    }
  }

  for (const heading of [
    '## 1. 目的与范围',
    '## 2. 扫描方法',
    '## 3. 能力矩阵',
    '## 5. M-5 门禁状态',
  ]) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  const rows = parseMatrixRows(content);
  const foundIds = new Set(rows.map((r) => r.id));
  for (const id of REQUIRED_MATRIX_IDS) {
    if (!foundIds.has(id)) errors.push(`matrix row missing: ${id}`);
  }

  for (const row of rows) {
    if (!ALLOWED_STATUSES.has(row.status)) {
      errors.push(
        `${row.id} status must be one of ${[...ALLOWED_STATUSES].join(', ')}`,
      );
    }
  }

  if (!content.includes('architecture.md') || !content.includes('§9')) {
    errors.push('must reference docs/architecture/architecture.md §9 Binary');
  }

  const gate = fm?.m5BinaryPlanGate ?? 'blocked';
  return { ok: errors.length === 0, m5BinaryPlanGate: gate, errors };
}

/** Throws when B-6 (gates.m5-binary-plan) has not cleared implementation. */
export function assertM5BinaryImplementationAllowed(docPath = SNAPSHOT_PATH) {
  const result = validateBinaryCurrentState(docPath);
  if (!result.ok) {
    throw new Error(
      `Binary B-1 snapshot invalid — implementation blocked: ${result.errors.join('; ')}`,
    );
  }
  if (result.m5BinaryPlanGate !== 'cleared') {
    throw new Error(
      'B-6 未通过 — m5BinaryPlanGate blocked; M-5 binary implementation tests must fail until user confirms plan (T-103)',
    );
  }
}

test('AC-045: B-1 snapshot document exists with capability matrix', () => {
  const result = validateBinaryCurrentState();
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-045: all required capability rows documented', () => {
  const content = readFileSync(SNAPSHOT_PATH, 'utf8');
  const rows = parseMatrixRows(content);
  const ids = rows.map((r) => r.id);
  for (const id of REQUIRED_MATRIX_IDS) {
    assert.ok(ids.includes(id), `missing matrix id ${id}`);
  }
  assert.ok(rows.length >= REQUIRED_MATRIX_IDS.length);
});

test('B-6: implementation tests pass when m5BinaryPlanGate cleared', () => {
  const result = validateBinaryCurrentState();
  assert.equal(
    result.m5BinaryPlanGate,
    'cleared',
    'B-6 确认后 m5BinaryPlanGate 须为 cleared',
  );
  assert.doesNotThrow(
    () => assertM5BinaryImplementationAllowed(),
    'assertM5BinaryImplementationAllowed must not throw after B-6 confirmation',
  );
});
