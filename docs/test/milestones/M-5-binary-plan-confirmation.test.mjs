#!/usr/bin/env node
/**
 * AC-046 / T-103: M-5 Binary B-6 human plan confirmation gate.
 * Run: node docs/test/milestones/M-5-binary-plan-confirmation.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertM5BinaryImplementationAllowed } from '../../architecture/binary-current-state.test.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const CONFIRMATION_PATH = join(root, 'M-5-binary-plan-confirmation.md');

const REQUIRED_CONFIRM_IDS = [
  'CONF-01',
  'CONF-02',
  'CONF-03',
  'CONF-04',
  'CONF-05',
  'CONF-06',
];

const EXPECTED_DECISIONS = {
  'CONF-01': 'OPT-01',
  'CONF-02': '256 KiB',
  'CONF-03': '32 MiB',
  'CONF-04': 'combineByKey',
  'CONF-05': 'form field',
  'CONF-06': 'off',
};

const REQUIRED_SECTIONS = [
  '## 1. 确认摘要',
  '## 2. 选定方案',
  '## 3. 确认项决选',
  '## 4. 门禁结论',
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

export function parseConfirmRows(content) {
  const sectionMatch = content.match(/^## 3\. 确认项决选\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| CONF-')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 3) continue;
    rows.push({ id: cells[0], decision: cells[2] ?? '' });
  }
  return rows;
}

export function validateM5BinaryPlanConfirmation(docPath = CONFIRMATION_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      humanGate: 'blocked',
      b6ImplementationGate: 'blocked',
      errors: [
        'M-5-binary-plan-confirmation.md missing — B-6 human confirmation blocked (AC-046 / T-103)',
      ],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-046') errors.push('frontmatter trace must be AC-046');
    if (fm.task !== 'T-103') errors.push('frontmatter task must be T-103');
    if (fm.humanGate !== 'approved') {
      errors.push(`frontmatter humanGate must be approved, got ${fm.humanGate}`);
    }
    if (fm.selectedOption !== 'OPT-01') {
      errors.push(`frontmatter selectedOption must be OPT-01, got ${fm.selectedOption}`);
    }
    if (fm.b6ImplementationGate !== 'cleared') {
      errors.push(
        `frontmatter b6ImplementationGate must be cleared, got ${fm.b6ImplementationGate}`,
      );
    }
    if (fm.confirmedAt !== '2026-06-21') {
      errors.push(`frontmatter confirmedAt must be 2026-06-21, got ${fm.confirmedAt}`);
    }
    if (fm.confirmedBy !== 'user') {
      errors.push(`frontmatter confirmedBy must be user, got ${fm.confirmedBy}`);
    }
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  const confirms = parseConfirmRows(content);
  const confirmIds = new Set(confirms.map((r) => r.id));
  for (const id of REQUIRED_CONFIRM_IDS) {
    if (!confirmIds.has(id)) errors.push(`confirmation row missing: ${id}`);
  }

  for (const row of confirms) {
    const expected = EXPECTED_DECISIONS[row.id];
    if (expected && !row.decision.includes(expected)) {
      errors.push(`${row.id} decision must include "${expected}", got "${row.decision}"`);
    }
  }

  const requiredRefs = [
    'binary-options.md',
    'binary-risks.md',
    'architecture.md',
    '§9',
    'P1',
    'P4',
  ];
  for (const ref of requiredRefs) {
    if (!content.includes(ref)) errors.push(`must reference: ${ref}`);
  }

  return {
    ok: errors.length === 0,
    humanGate: fm?.humanGate ?? 'blocked',
    b6ImplementationGate: fm?.b6ImplementationGate ?? 'blocked',
    selectedOption: fm?.selectedOption,
    errors,
  };
}

test('AC-046 / T-103: B-6 confirmation document exists with approved humanGate', () => {
  const result = validateM5BinaryPlanConfirmation();
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.humanGate, 'approved');
  assert.equal(result.selectedOption, 'OPT-01');
  assert.equal(result.b6ImplementationGate, 'cleared');
});

test('AC-046 / T-103: all CONF-01～06 decisions documented', () => {
  const content = readFileSync(CONFIRMATION_PATH, 'utf8');
  const confirms = parseConfirmRows(content);
  for (const id of REQUIRED_CONFIRM_IDS) {
    assert.ok(confirms.some((r) => r.id === id), `missing confirm id ${id}`);
  }
});

test('AC-046 / T-103: B-6 cleared — binary implementation allowed', () => {
  const result = validateM5BinaryPlanConfirmation();
  assert.equal(result.b6ImplementationGate, 'cleared');
  assert.doesNotThrow(
    () => assertM5BinaryImplementationAllowed(),
    'assertM5BinaryImplementationAllowed must not throw after B-6 confirmation',
  );
});
