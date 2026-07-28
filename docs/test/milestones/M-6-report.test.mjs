#!/usr/bin/env node
/**
 * AC-069 / T-168: M-6 help coverage milestone E2E regression report gate.
 * Run: node docs/test/milestones/M-6-report.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(root, 'M-6-report.md');

const REQUIRED_SECTIONS = [
  '## Milestone',
  '## 测试范围',
  '## 执行结果',
  '## TDD 证据审查',
  '## 用例列表',
  '## 结论',
];

const REQUIRED_AC_REFS = ['AC-057', 'AC-063', 'AC-066', 'AC-069'];

const REQUIRED_E2E_EVIDENCE = [
  'help-all-nodes',
  'platform-capabilities',
  'validate-e2e-matrix.mjs --require-full',
];

/**
 * @param {string} docPath
 */
export function validateM6Report(docPath = REPORT_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      errors: ['M-6-report.md missing — AC-069 / T-168 blocked'],
    };
  }

  const content = readFileSync(docPath, 'utf8');

  if (!content.includes('M-6') || !content.includes('帮助')) {
    errors.push('report must identify milestone M-6 help coverage');
  }

  if (!content.includes('milestone/m-6-help')) {
    errors.push('report must reference branch milestone/m-6-help');
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

  if (!/T-115.*T-168|T-115～T-168|54\/54/.test(content)) {
    errors.push('must reference M-6 task range T-115～T-168 (54 tasks)');
  }

  const conclusionMatch = content.match(/^## 结论\s*\r?\n\s*\r?\n`?(passed|failed)`?/m);
  if (!conclusionMatch) {
    errors.push('## 结论 must declare passed or failed');
  } else if (conclusionMatch[1] !== 'passed') {
    errors.push(`## 结论 must be passed for T-168 Green, got "${conclusionMatch[1]}"`);
  }

  if (!/(\d+)\s*passed|\d+\/\d+\s*pass|pass.*\d+/i.test(content)) {
    errors.push('must record E2E pass counts in execution results');
  }

  if (!content.includes('M-6-acceptance.md')) {
    errors.push('must reference M-6-acceptance.md (T-167 dependency)');
  }

  if (!content.includes('e2e-coverage-matrix')) {
    errors.push('must reference e2e-coverage-matrix (T-165 dependency)');
  }

  if (!content.includes('lint:docs-index')) {
    errors.push('must reference lint:docs-index (T-166 dependency)');
  }

  return { ok: errors.length === 0, errors, conclusion: conclusionMatch?.[1] };
}

test('AC-069 / T-168: M-6 regression report exists with required structure', () => {
  const result = validateM6Report();
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-069 / T-168: report conclusion is passed', () => {
  const result = validateM6Report();
  assert.equal(result.conclusion, 'passed', result.errors.join('; '));
});
