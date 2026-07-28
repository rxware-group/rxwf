#!/usr/bin/env node
/**
 * AC-045 / T-101: Binary industry sampling + solution options (B-3 / B-5).
 * humanGate approved after B-6 user confirmation (T-103).
 * Run: node docs/architecture/binary-options.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const OPTIONS_PATH = join(root, 'binary-options.md');

const REQUIRED_OPTION_IDS = ['OPT-01', 'OPT-02'];

const REQUIRED_INDUSTRY_IDS = ['IND-01', 'IND-02'];

const REQUIRED_SECTIONS = [
  '## 1. 目的与范围',
  '## 2. 业界采样（B-3）',
  '## 3. 方案选项对照（B-5）',
  '## 4. 人工确认门禁（B-6 已确认）',
];

const FORBIDDEN_DECISION_MARKERS = [
  /^decision:/m,
  /已决选方案/,
  /推荐方案.*OPT-/,
];

function isB6Approved(fm) {
  return fm?.humanGate === 'approved' && fm?.selectedOption === 'OPT-01';
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

export function parseOptionRows(content) {
  const sectionMatch = content.match(/^## 3\. 方案选项对照（B-5）\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| OPT-')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    rows.push({
      id: cells[0],
      name: cells[1],
      scope: cells[2],
    });
  }
  return rows;
}

export function parseIndustryRows(content) {
  const sectionMatch = content.match(/^## 2\. 业界采样（B-3）\s*$/m);
  if (!sectionMatch) return [];
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length);
  const next = rest.search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('| IND-')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    rows.push({
      id: cells[0],
      system: cells[1],
    });
  }
  return rows;
}

export function validateBinaryOptions(docPath = OPTIONS_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      humanGate: 'blocked',
      errors: ['binary-options.md missing — B-5 options gate blocked (AC-045 / T-101)'],
    };
  }

  const content = readFileSync(docPath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('YAML frontmatter required');
  } else {
    if (fm.trace !== 'AC-045') errors.push('frontmatter trace must be AC-045');
    if (fm.task !== 'T-101') errors.push('frontmatter task must be T-101');
    if (!fm.reviewDate) errors.push('frontmatter reviewDate required');
    if (!isB6Approved(fm)) {
      if (fm.humanGate !== 'pending') {
        errors.push(`frontmatter humanGate must be pending (awaiting B-6), got ${fm.humanGate}`);
      }
      if (fm.selectedOption) {
        errors.push('frontmatter must not contain selectedOption before B-6');
      }
    } else {
      if (fm.humanGate !== 'approved') {
        errors.push(`frontmatter humanGate must be approved after B-6, got ${fm.humanGate}`);
      }
      if (fm.selectedOption !== 'OPT-01') {
        errors.push(`frontmatter selectedOption must be OPT-01, got ${fm.selectedOption}`);
      }
    }
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  if (!isB6Approved(fm)) {
    for (const pattern of FORBIDDEN_DECISION_MARKERS) {
      if (pattern.test(content)) {
        errors.push(`document must not contain final decision marker: ${pattern}`);
      }
    }
  }

  const options = parseOptionRows(content);
  const optionIds = new Set(options.map((r) => r.id));
  for (const id of REQUIRED_OPTION_IDS) {
    if (!optionIds.has(id)) errors.push(`option row missing: ${id}`);
  }
  if (options.length < 2) {
    errors.push('must document at least 2 solution options (B-5)');
  }

  const industries = parseIndustryRows(content);
  const industryIds = new Set(industries.map((r) => r.id));
  for (const id of REQUIRED_INDUSTRY_IDS) {
    if (!industryIds.has(id)) errors.push(`industry sampling row missing: ${id}`);
  }

  const requiredRefs = [
    'docs/architecture/architecture.md',
    '§9',
    'OQ-005',
    'binary-n8n-review.md',
    '2026-06-03-workflow-binary-support-design.md',
  ];
  for (const ref of requiredRefs) {
    if (!content.includes(ref)) errors.push(`must reference: ${ref}`);
  }

  const gate = fm?.humanGate ?? 'blocked';
  return { ok: errors.length === 0, humanGate: gate, errors };
}

test('AC-045 / T-101: binary options document exists with humanGate approved', () => {
  const result = validateBinaryOptions();
  assert.equal(
    result.humanGate,
    'approved',
    'B-6 确认后 humanGate 须为 approved',
  );
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-045 / T-101: at least two solution options documented (B-5)', () => {
  const content = readFileSync(OPTIONS_PATH, 'utf8');
  const options = parseOptionRows(content);
  const ids = options.map((r) => r.id);
  for (const id of REQUIRED_OPTION_IDS) {
    assert.ok(ids.includes(id), `missing option id ${id}`);
  }
  assert.ok(options.length >= 2);
});

test('AC-045 / T-101: industry sampling covers n8n peer systems (B-3)', () => {
  const content = readFileSync(OPTIONS_PATH, 'utf8');
  const industries = parseIndustryRows(content);
  const ids = industries.map((r) => r.id);
  for (const id of REQUIRED_INDUSTRY_IDS) {
    assert.ok(ids.includes(id), `missing industry id ${id}`);
  }
  assert.ok(industries.length >= 2);
});

test('AC-045 / T-101: B-6 confirmed — selectedOption OPT-01', () => {
  const content = readFileSync(OPTIONS_PATH, 'utf8');
  const fm = parseFrontmatter(content);
  assert.equal(fm?.humanGate, 'approved');
  assert.equal(fm?.selectedOption, 'OPT-01');
});
