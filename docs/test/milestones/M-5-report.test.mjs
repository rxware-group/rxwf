#!/usr/bin/env node
/**
 * AC-056 / T-114: M-5 Binary milestone E2E regression report gate.
 * Run: node docs/test/milestones/M-5-report.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuditTable } from '../../../scripts/validate-spec-gap-audit.mjs';
import { assertM5BinaryImplementationAllowed } from '../../architecture/binary-current-state.test.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(root, 'M-5-report.md');
const SPEC_GAP_PATH = join(root, '../../workflow/spec-gap-audit.md');

const REQUIRED_SECTIONS = [
  '## Milestone',
  '## 测试范围',
  '## 执行结果',
  '## TDD 证据审查',
  '## 用例列表',
  '## 结论',
];

const REQUIRED_AC_REFS = ['AC-052', 'AC-056'];

const REQUIRED_E2E_EVIDENCE = [
  'binary-full-chain',
  'E2E-P-014',
  'BINARY_FULL_CHAIN_E2E_GREEN',
];

/**
 * @param {string} docPath
 */
export function validateM5Report(docPath = REPORT_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      errors: ['M-5-report.md missing — AC-056 / T-114 blocked'],
    };
  }

  const content = readFileSync(docPath, 'utf8');

  if (!content.includes('M-5') || !content.includes('Binary')) {
    errors.push('report must identify milestone M-5 Binary');
  }

  if (!content.includes('milestone/m-5-binary')) {
    errors.push('report must reference branch milestone/m-5-binary');
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  for (const ac of REQUIRED_AC_REFS) {
    if (!content.includes(ac)) errors.push(`must reference ${ac}`);
  }

  for (const token of REQUIRED_E2E_EVIDENCE) {
    if (!content.includes(token)) errors.push(`must document E2E evidence: ${token}`);
  }

  if (!/T-099.*T-114|T-099～T-114|16\/16/.test(content)) {
    errors.push('must reference M-5 task range T-099～T-114 (16 tasks)');
  }

  const conclusionMatch = content.match(/^## 结论\s*\r?\n\s*\r?\n`?(passed|failed)`?/m);
  if (!conclusionMatch) {
    errors.push('## 结论 must declare passed or failed');
  } else if (conclusionMatch[1] !== 'passed') {
    errors.push(`## 结论 must be passed for T-114 Green, got "${conclusionMatch[1]}"`);
  }

  if (!/(\d+)\s*passed|\d+\/\d+\s*pass|pass.*\d+/i.test(content)) {
    errors.push('must record E2E pass counts in execution results');
  }

  if (!content.includes('M-5-acceptance.md')) {
    errors.push('must reference M-5-acceptance.md (T-113 dependency)');
  }

  if (!content.includes('e2e-coverage-matrix')) {
    errors.push('must reference e2e-coverage-matrix (T-112 dependency)');
  }

  return { ok: errors.length === 0, errors, conclusion: conclusionMatch?.[1] };
}

/**
 * @param {string} auditPath
 */
export function validateGap012StillDone(auditPath = SPEC_GAP_PATH) {
  const errors = [];
  const content = readFileSync(auditPath, 'utf8');
  const { rows } = parseAuditTable(content);
  const gap012 = rows.find((row) => row.gap_id === 'GAP-012');
  if (!gap012) {
    errors.push('GAP-012 row missing');
  } else if (gap012.gap !== 'done' || gap012.audit_status !== 'done') {
    errors.push(`GAP-012 must remain done, got gap=${gap012.gap} audit=${gap012.audit_status}`);
  }
  return { ok: errors.length === 0, errors };
}

test('B-6: M-5 report tests allowed after plan confirmation', () => {
  assert.doesNotThrow(() => assertM5BinaryImplementationAllowed());
});

test('AC-056 / T-114: M-5 regression report exists with required structure', () => {
  const result = validateM5Report();
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-056 / T-114: report conclusion is passed', () => {
  const result = validateM5Report();
  assert.equal(result.conclusion, 'passed', result.errors.join('; '));
});

test('AC-056 / T-114: GAP-012 remains closed', () => {
  const result = validateGap012StillDone();
  assert.equal(result.ok, true, result.errors.join('; '));
});
