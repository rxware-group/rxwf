#!/usr/bin/env node
/**
 * AC-045 / AC-055 / T-102: Binary gap/risk + ADR impact checklist (B-4).
 * b6ImplementationGate cleared after B-6 user confirmation (T-103).
 * Run: node docs/architecture/binary-risks.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertM5BinaryImplementationAllowed } from './binary-current-state.test.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const RISKS_PATH = join(root, 'binary-risks.md');

const REQUIRED_GAP_IDS = ['GAP-01', 'GAP-02', 'GAP-03', 'GAP-04', 'GAP-05'];

const REQUIRED_RISK_IDS = ['RISK-01', 'RISK-02', 'RISK-03', 'RISK-04'];

const REQUIRED_CONFIRM_IDS = [
  'CONF-01',
  'CONF-02',
  'CONF-03',
  'CONF-04',
  'CONF-05',
  'CONF-06',
];

const REQUIRED_SECTIONS = [
  '## 1. 目的与范围',
  '## 2. 输入依赖',
  '## 3. 差距清单',
  '## 4. 风险清单',
  '## 5. ADR-005 影响分析',
  '## 6. 须人工确认项',
  '## 7. B-4 门禁结论',
];

const FORBIDDEN_DECISION_MARKERS = [
  /^selectedOption:/m,
  /^decision:/m,
  /已决选方案/,
  /最终方案.*OPT-/,
];

function isB6Cleared(fm) {
  return fm?.b6ImplementationGate === 'cleared';
}

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

export function parseTableRows(content, sectionHeading, idPrefix) {
  const sectionMatch = content.match(new RegExp(`^${sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith(`| ${idPrefix}`)) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 3) continue;
    rows.push({ id: cells[0], label: cells[1] ?? cells[0] });
  }
  return rows;
}

export function validateBinaryRisks(docPath = RISKS_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      b4RisksGate: 'blocked',
      b6ImplementationGate: 'blocked',
      errors: ['binary-risks.md missing — B-4 gap/risk gate blocked (AC-055 / T-102)'],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-045') errors.push('frontmatter trace must be AC-045');
    if (fm.task !== 'T-102') errors.push('frontmatter task must be T-102');
    if (!fm.reviewDate) errors.push('frontmatter reviewDate required');
    if (!['approved', 'draft'].includes(fm.status ?? '')) {
      errors.push(`frontmatter status must be approved or draft, got ${fm.status}`);
    }
    if (fm.b4RisksGate !== 'cleared') {
      errors.push(`frontmatter b4RisksGate must be cleared, got ${fm.b4RisksGate}`);
    }
    if (!isB6Cleared(fm)) {
      if (fm.b6ImplementationGate !== 'blocked') {
        errors.push(
          `frontmatter b6ImplementationGate must be blocked (B-6 pending), got ${fm.b6ImplementationGate}`,
        );
      }
      if (fm.selectedOption) {
        errors.push('frontmatter must not contain selectedOption before B-6');
      }
    } else if (fm.b6ImplementationGate !== 'cleared') {
      errors.push(
        `frontmatter b6ImplementationGate must be cleared after B-6, got ${fm.b6ImplementationGate}`,
      );
    }
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  if (!isB6Cleared(fm)) {
    for (const pattern of FORBIDDEN_DECISION_MARKERS) {
      if (pattern.test(content)) {
        errors.push(`document must not contain final decision marker: ${pattern}`);
      }
    }
  }

  const gaps = parseTableRows(content, '## 3. 差距清单', 'GAP-');
  const gapIds = new Set(gaps.map((r) => r.id));
  for (const id of REQUIRED_GAP_IDS) {
    if (!gapIds.has(id)) errors.push(`gap row missing: ${id}`);
  }

  const risks = parseTableRows(content, '## 4. 风险清单', 'RISK-');
  const riskIds = new Set(risks.map((r) => r.id));
  for (const id of REQUIRED_RISK_IDS) {
    if (!riskIds.has(id)) errors.push(`risk row missing: ${id}`);
  }

  const confirms = parseTableRows(content, '## 6. 须人工确认项', 'CONF-');
  const confirmIds = new Set(confirms.map((r) => r.id));
  for (const id of REQUIRED_CONFIRM_IDS) {
    if (!confirmIds.has(id)) errors.push(`human confirmation row missing: ${id}`);
  }

  const requiredRefs = [
    'docs/architecture/architecture.md',
    '§9',
    'binary-current-state.md',
    'binary-n8n-review.md',
    'binary-options.md',
    'adr-execution-data.md',
    'ADR-005',
    'AC-055',
    'FR-16',
  ];
  for (const ref of requiredRefs) {
    if (!content.includes(ref)) errors.push(`must reference: ${ref}`);
  }

  if (!content.includes('32 MiB') && !content.includes('32MiB')) {
    errors.push('must document 32 MiB item limit for human confirmation');
  }

  const b4Gate = fm?.b4RisksGate ?? 'blocked';
  const b6Gate = fm?.b6ImplementationGate ?? 'blocked';
  return {
    ok: errors.length === 0,
    b4RisksGate: b4Gate,
    b6ImplementationGate: b6Gate,
    errors,
  };
}

test('AC-055 / T-102: B-4 gap/risk document clears risks gate', () => {
  const result = validateBinaryRisks();
  assert.equal(
    result.b4RisksGate,
    'cleared',
    '未完成 B-4 差距/风险清单应阻塞门禁',
  );
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-055 / T-102: gap, risk, and human confirmation rows documented', () => {
  const content = readFileSync(RISKS_PATH, 'utf8');
  const gaps = parseTableRows(content, '## 3. 差距清单', 'GAP-');
  const risks = parseTableRows(content, '## 4. 风险清单', 'RISK-');
  const confirms = parseTableRows(content, '## 6. 须人工确认项', 'CONF-');
  for (const id of REQUIRED_GAP_IDS) {
    assert.ok(gaps.some((r) => r.id === id), `missing gap id ${id}`);
  }
  for (const id of REQUIRED_RISK_IDS) {
    assert.ok(risks.some((r) => r.id === id), `missing risk id ${id}`);
  }
  for (const id of REQUIRED_CONFIRM_IDS) {
    assert.ok(confirms.some((r) => r.id === id), `missing confirm id ${id}`);
  }
});

test('AC-055 / T-102: B-6 passed — binary implementation allowed', () => {
  const result = validateBinaryRisks();
  assert.equal(
    result.b6ImplementationGate,
    'cleared',
    'B-6 确认后 binary 实现门禁须 cleared',
  );
  const content = readFileSync(RISKS_PATH, 'utf8');
  const fm = parseFrontmatter(content);
  assert.equal(fm?.b6ImplementationGate, 'cleared');
  assert.doesNotThrow(
    () => assertM5BinaryImplementationAllowed(),
    'assertM5BinaryImplementationAllowed must not throw after B-6 confirmation',
  );
});
