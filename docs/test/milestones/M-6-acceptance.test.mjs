#!/usr/bin/env node
/**
 * AC-065 / T-167: M-6 help manual acceptance checklist structure gate.
 * Run: node docs/test/milestones/M-6-acceptance.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const ACCEPTANCE_PATH = join(root, 'M-6-acceptance.md');

/** AC-057～069 + AC-070 per PRD §5.6 / M-6 milestone scope */
const REQUIRED_AC_COVERAGE = [
  'AC-057',
  'AC-058',
  'AC-059',
  'AC-060',
  'AC-061',
  'AC-062',
  'AC-063',
  'AC-064',
  'AC-065',
  'AC-066',
  'AC-067',
  'AC-068',
  'AC-069',
  'AC-070',
];

const REQUIRED_SECTIONS = [
  '## AC 映射摘要',
  '## 用例清单',
];

const REQUIRED_THEMES = [
  { id: 'helpDocs', patterns: [/45.*help|帮助文档|nodeType/i] },
  { id: 'registry', patterns: [/help-registry|registry/i] },
  { id: 'matrix', patterns: [/matrix|100%/i] },
  { id: 'index', patterns: [/INDEX|lint:docs-index/i] },
  { id: 'e2e', patterns: [/E2E|help-all-nodes|platform-capabilities/i] },
];

const CASE_ID_PATTERN = /^### M6-MAN-\d{3}：/gm;

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
export function validateM6Acceptance(docPath = ACCEPTANCE_PATH) {
  const errors = [];
  if (!existsSync(docPath)) {
    return {
      ok: false,
      errors: ['M-6-acceptance.md missing — AC-065 blocked'],
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

  if (!content.includes('milestone: M-6')) {
    errors.push('frontmatter must include milestone: M-6');
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!content.includes(heading)) errors.push(`missing section: ${heading}`);
  }

  if (!content.includes('OQ-009') && !content.includes('E2E 互补')) {
    errors.push('must document OQ-009 E2E complement relationship');
  }

  const caseBlocks = parseCaseBlocks(content);
  if (caseBlocks.length < 12) {
    errors.push(`need >= 12 manual cases, found ${caseBlocks.length}`);
  }

  for (const block of caseBlocks) {
    const requiredFields = ['追溯 AC', '步骤', '期望'];
    for (const field of requiredFields) {
      if (!block.includes(field)) {
        const idMatch = block.match(/M6-MAN-\d{3}/);
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

  return {
    ok: errors.length === 0,
    errors,
    caseCount: caseBlocks.length,
    acCoverage,
  };
}

test('AC-065 / T-167: M-6 acceptance document structure', () => {
  const result = validateM6Acceptance();
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.caseCount >= 12, `expected >= 12 cases, got ${result.caseCount}`);
});

test('AC-065 / T-167: AC-057～069 + AC-070 in frontmatter', () => {
  const content = readFileSync(ACCEPTANCE_PATH, 'utf8');
  const acCoverage = parseYamlList(content, 'ac_coverage');
  for (const ac of REQUIRED_AC_COVERAGE) {
    assert.ok(acCoverage.includes(ac), `missing ac_coverage entry: ${ac}`);
  }
});
