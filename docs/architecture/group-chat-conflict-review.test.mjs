#!/usr/bin/env node
/**
 * AC-038 / T-085: Group Chat vs Crew/Agent architecture conflict review gate.
 * Run: node docs/architecture/group-chat-conflict-review.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const REVIEW_PATH = join(root, 'group-chat-conflict-review.md');

const REQUIRED_CONFLICT_IDS = [
  'GC-01',
  'GC-02',
  'GC-03',
  'GC-04',
  'GC-05',
  'GC-06',
  'GC-07',
  'GC-08',
  'GC-09',
  'GC-10',
];

const ALLOWED_CONCLUSIONS = new Set(['无冲突', '已接受差异', '已人工确认']);

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

export function parseConflictRows(content) {
  const sectionMatch = content.match(/^## 3\. 冲突对照表\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| GC-')) continue;
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

export function validateGroupChatConflictReview(docPath = REVIEW_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      m4ImplementationGate: 'blocked',
      errors: ['group-chat-conflict-review.md missing — M-4 implementation blocked (AC-038)'],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-038') errors.push('frontmatter trace must be AC-038');
    if (!fm.reviewDate) errors.push('frontmatter reviewDate required');
    if (!['approved', 'cleared'].includes(fm.status ?? '')) {
      errors.push(`frontmatter status must be approved or cleared, got ${fm.status}`);
    }
    if (!['cleared', 'blocked'].includes(fm.m4ImplementationGate ?? '')) {
      errors.push('frontmatter m4ImplementationGate must be cleared or blocked');
    }
  }

  for (const heading of [
    '## 1. 目的与范围',
    '## 2. 评估方法',
    '## 3. 冲突对照表',
    '## 5. M-4 实施门禁结论',
  ]) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  const rows = parseConflictRows(content);
  const foundIds = new Set(rows.map((r) => r.id));
  for (const id of REQUIRED_CONFLICT_IDS) {
    if (!foundIds.has(id)) errors.push(`conflict row missing: ${id}`);
  }

  for (const row of rows) {
    if (!ALLOWED_CONCLUSIONS.has(row.conclusion)) {
      errors.push(`${row.id} conclusion must be one of ${[...ALLOWED_CONCLUSIONS].join(', ')}`);
    }
    if (row.conclusion === '需暂停 M-4') {
      errors.push(`${row.id} has 需暂停 M-4 — requires human confirmation before M-4`);
    }
  }

  const gate = fm?.m4ImplementationGate ?? 'blocked';
  if (gate !== 'cleared') {
    errors.push(`m4ImplementationGate=${gate} — M-4 Wave 2+ tasks blocked until cleared`);
  }

  if (!content.includes('architecture.md') || !content.includes('§8')) {
    errors.push('must reference docs/architecture/architecture.md §8 Group Chat');
  }

  return { ok: errors.length === 0, m4ImplementationGate: gate, errors };
}

test('AC-038: conflict review document exists and clears M-4 gate', () => {
  const result = validateGroupChatConflictReview();
  assert.equal(
    result.m4ImplementationGate,
    'cleared',
    '未记录冲突评估应阻塞 M-4 实现测试',
  );
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-038: all required conflict domains documented', () => {
  const content = readFileSync(REVIEW_PATH, 'utf8');
  const rows = parseConflictRows(content);
  const ids = rows.map((r) => r.id);
  for (const id of REQUIRED_CONFLICT_IDS) {
    assert.ok(ids.includes(id), `missing conflict id ${id}`);
  }
  assert.ok(rows.length >= REQUIRED_CONFLICT_IDS.length);
});

test('AC-038: no unresolved architecture conflicts', () => {
  const content = readFileSync(REVIEW_PATH, 'utf8');
  const rows = parseConflictRows(content);
  const pending = rows.filter((r) => !ALLOWED_CONCLUSIONS.has(r.conclusion));
  assert.equal(
    pending.length,
    0,
    `unresolved conflicts: ${pending.map((r) => r.id).join(', ')}`,
  );
});
