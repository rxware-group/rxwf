#!/usr/bin/env node
/**
 * AC-054 / T-113: M-5 Binary manual acceptance checklist + GAP-012 closed.
 * Run: node docs/test/milestones/M-5-acceptance.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuditTable } from '../../../scripts/validate-spec-gap-audit.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const ACCEPTANCE_PATH = join(root, 'M-5-acceptance.md');
const SPEC_GAP_PATH = join(root, '../../workflow/spec-gap-audit.md');

/** AC-045～056 + AC-070 per PRD §5.5 / M-5 milestone scope */
const REQUIRED_AC_COVERAGE = [
  'AC-045',
  'AC-046',
  'AC-047',
  'AC-048',
  'AC-049',
  'AC-050',
  'AC-051',
  'AC-052',
  'AC-053',
  'AC-054',
  'AC-055',
  'AC-056',
  'AC-070',
];

const REQUIRED_SECTIONS = [
  '## AC 映射摘要',
  '## 用例清单',
  '## 验收签字',
];

/** PRD §9 M-5 minimum themes: plan confirmation + upload/download/expression/pass-through */
const REQUIRED_THEMES = [
  { id: 'planConfirmation', patterns: [/方案确认|M-5-binary-plan-confirmation|B-6|OPT-01/i] },
  { id: 'upload', patterns: [/上传|multipart|Webhook.*binary|binaryFromItem/i] },
  { id: 'download', patterns: [/下载|HTTP.*响应|responseBinaryMode/i] },
  { id: 'expression', patterns: [/\$binary|表达式/i] },
  { id: 'passThrough', patterns: [/透传|传递|pass.?through|节点间/i] },
];

const CASE_ID_PATTERN = /^### M5-MAN-\d{3}：/gm;

/**
 * @param {string} content
 */
export function parseYamlList(content, key) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return [];
  const fm = fmMatch[1];
  const match = fm.match(new RegExp(`^${key}:\\s*\\r?\\n((?:\\s+-\\s+.+\\r?\\n)+)`, 'm'));
  if (!match) return [];
  return [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].map((m) => m[1].trim());
}

/**
 * @param {string} content
 */
export function parseCaseBlocks(content) {
  const blocks = [];
  const matches = [...content.matchAll(CASE_ID_PATTERN)];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
    blocks.push(content.slice(start, end));
  }
  return blocks;
}

/**
 * @param {string} docPath
 */
export function validateM5Acceptance(docPath = ACCEPTANCE_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      errors: ['M-5-acceptance.md missing — AC-054 / T-113 blocked'],
      caseCount: 0,
    };
  }

  const content = readFileSync(docPath, 'utf8');

  if (!content.match(/^---\r?\n[\s\S]*?\r?\n---/)) {
    errors.push('YAML frontmatter required');
  }

  const acCoverage = parseYamlList(content, 'ac_coverage');
  for (const ac of REQUIRED_AC_COVERAGE) {
    if (!acCoverage.includes(ac)) {
      errors.push(`frontmatter ac_coverage missing: ${ac}`);
    }
  }

  if (!content.includes('milestone: M-5')) {
    errors.push('frontmatter must include milestone: M-5');
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  if (!content.includes('OQ-009') && !content.includes('E2E 互补')) {
    errors.push('must document OQ-009 E2E complement relationship');
  }

  const caseBlocks = parseCaseBlocks(content);
  if (caseBlocks.length < 8) {
    errors.push(`need >= 8 manual cases, found ${caseBlocks.length}`);
  }

  for (const block of caseBlocks) {
    const requiredFields = ['追溯 AC', '前置条件', '步骤', '预期结果', '执行结果', '所属轨'];
    for (const field of requiredFields) {
      if (!block.includes(field)) {
        const idMatch = block.match(/M5-MAN-\d{3}/);
        errors.push(`${idMatch?.[0] ?? 'case'}: missing field "${field}"`);
      }
    }
  }

  for (const theme of REQUIRED_THEMES) {
    const found = theme.patterns.some((re) => re.test(content));
    if (!found) {
      errors.push(`missing theme coverage: ${theme.id}`);
    }
  }

  const acMapSection = content.match(/## AC 映射摘要[\s\S]*?(?=^## )/m);
  if (acMapSection) {
    for (const ac of ['AC-045', 'AC-046', 'AC-047', 'AC-048', 'AC-049', 'AC-050']) {
      if (!acMapSection[0].includes(ac)) {
        errors.push(`AC mapping table missing row for ${ac}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    caseCount: caseBlocks.length,
    acCoverage,
  };
}

/**
 * @param {string} auditPath
 */
export function validateGap012Closed(auditPath = SPEC_GAP_PATH) {
  const errors = [];
  if (!existsSync(auditPath)) {
    return { ok: false, errors: ['spec-gap-audit.md missing'] };
  }

  const content = readFileSync(auditPath, 'utf8');
  const { rows } = parseAuditTable(content);
  const gap012 = rows.find((row) => row.gap_id === 'GAP-012');
  if (!gap012) {
    errors.push('GAP-012 row missing');
    return { ok: false, errors };
  }

  if (gap012.gap !== 'done') {
    errors.push(`GAP-012 gap must be done, got "${gap012.gap}"`);
  }
  if (gap012.audit_status !== 'done') {
    errors.push(`GAP-012 audit_status must be done, got "${gap012.audit_status}"`);
  }
  if (!gap012.code_status.includes('OPT-01') && !gap012.code_status.includes('E2E') && !gap012.code_status.includes('binary-full-chain')) {
    // code_status should reflect M-5 delivery — at minimum mention key deliverables
    if (!/HTTP|Webhook|Set|Merge|blob|透传/i.test(gap012.code_status)) {
      errors.push('GAP-012 code_status should describe M-5 Binary delivery');
    }
  }

  return { ok: errors.length === 0, errors, gap012 };
}

test('AC-054 / T-113: M-5 acceptance document structure', () => {
  const result = validateM5Acceptance();
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.caseCount >= 8, `expected >= 8 cases, got ${result.caseCount}`);
});

test('AC-054 / T-113: AC-045～056 + AC-070 in frontmatter', () => {
  const content = readFileSync(ACCEPTANCE_PATH, 'utf8');
  const acCoverage = parseYamlList(content, 'ac_coverage');
  for (const ac of REQUIRED_AC_COVERAGE) {
    assert.ok(acCoverage.includes(ac), `missing ac_coverage entry: ${ac}`);
  }
});

test('AC-054 / T-113: GAP-012 Binary closed in spec-gap-audit', () => {
  const result = validateGap012Closed();
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.gap012?.gap, 'done');
  assert.equal(result.gap012?.audit_status, 'done');
});
