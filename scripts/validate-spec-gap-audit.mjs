#!/usr/bin/env node
/**
 * Validates docs/workflow/spec-gap-audit.md against v2.0 gap audit requirements (AC-005/006).
 * Usage:
 *   node scripts/validate-spec-gap-audit.mjs
 *   node scripts/validate-spec-gap-audit.mjs --test
 *   node scripts/validate-spec-gap-audit.mjs --milestone M-2
 *   node scripts/validate-spec-gap-audit.mjs --require-closed
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DEFAULT_AUDIT = 'docs/workflow/spec-gap-audit.md';
const EXPECTED_GAP_COUNT = 40;
const FIRST_GAP_ID = 'GAP-001';
const LAST_GAP_ID = 'GAP-040';

/** AC-006 required columns (target_m = milestone). */
export const REQUIRED_COLUMNS = [
  'gap_id',
  'category',
  'spec_fr',
  'code_status',
  'gap',
  'target_m',
  'e2e_row_id',
  'audit_status',
];

const VALID_GAP_VALUES = new Set(['missing', 'partial', 'done', 'deferred']);
const VALID_AUDIT_STATUS = new Set(['open', 'done', 'deferred']);
const MILESTONE_PATTERN = /^M-\d+([+]|(→M-\d+))?$/;
const DONE_TARGET = new Set(['—', '-', '–']);

/**
 * @param {string} content
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseAuditTable(content) {
  const lines = content.split(/\r?\n/);
  let headerLine = null;
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    if (/^\|\s*gap_id\s*\|\s*category\s*\|/i.test(line)) {
      headerLine = line;
      separatorIndex = i + 1;
      break;
    }
  }

  if (!headerLine) {
    return { headers: [], rows: [] };
  }

  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

  const rows = [];
  for (let i = separatorIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    if (/^\|\s*-+\s*\|/.test(line)) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== headers.length) continue;

    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * @param {number} index 1-based
 */
function expectedGapId(index) {
  return `GAP-${String(index).padStart(3, '0')}`;
}

/**
 * @param {string} targetM
 */
function hasValidTargetMilestone(targetM) {
  if (!targetM) return false;
  if (DONE_TARGET.has(targetM)) return true;
  if (targetM === 'v2.0+') return true;
  return MILESTONE_PATTERN.test(targetM);
}

/**
 * @param {{
 *   repoRoot?: string,
 *   auditPath?: string,
 *   milestone?: string,
 *   requireClosed?: boolean,
 * }} [options]
 */
export function validateSpecGapAudit(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const auditPath = options.auditPath ?? join(repoRoot, DEFAULT_AUDIT);
  const milestone = options.milestone;
  const requireClosed = options.requireClosed ?? false;

  /** @type {string[]} */
  const errors = [];

  let content;
  try {
    content = readFileSync(auditPath, 'utf8');
  } catch {
    return {
      ok: false,
      errors: [`missing audit file: ${relativePath(repoRoot, auditPath)}`],
      rowCount: 0,
    };
  }

  const { headers, rows } = parseAuditTable(content);
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));

  for (const column of REQUIRED_COLUMNS) {
    if (!headerSet.has(column)) {
      errors.push(`missing required column: ${column}`);
    }
  }

  if (rows.length < EXPECTED_GAP_COUNT) {
    errors.push(`row count ${rows.length} < required ${EXPECTED_GAP_COUNT} (${FIRST_GAP_ID}～${LAST_GAP_ID})`);
  }

  const rowById = new Map(rows.map((row) => [row.gap_id, row]));

  for (let i = 1; i <= EXPECTED_GAP_COUNT; i += 1) {
    const gapId = expectedGapId(i);
    const row = rowById.get(gapId);
    if (!row) {
      errors.push(`missing gap row: ${gapId}`);
      continue;
    }

    if (!row.spec_fr) {
      errors.push(`${gapId}: spec_fr is required`);
    }
    if (!row.code_status) {
      errors.push(`${gapId}: code_status is required`);
    }
    if (!row.e2e_row_id) {
      errors.push(`${gapId}: e2e_row_id is required`);
    }
    if (!VALID_GAP_VALUES.has(row.gap)) {
      errors.push(`${gapId}: invalid gap "${row.gap}"`);
    }
    if (!VALID_AUDIT_STATUS.has(row.audit_status)) {
      errors.push(`${gapId}: invalid audit_status "${row.audit_status}"`);
    }

    if (!hasValidTargetMilestone(row.target_m)) {
      errors.push(`${gapId}: invalid or missing target_m "${row.target_m}"`);
    }

    const isSemiImplOpen = row.gap === 'partial' && row.audit_status === 'open';
    if (isSemiImplOpen && !MILESTONE_PATTERN.test(row.target_m)) {
      errors.push(`${gapId}: open partial item requires concrete target_m milestone, got "${row.target_m}"`);
    }

    if (milestone && row.target_m.startsWith(milestone) && row.audit_status !== 'done') {
      errors.push(`${gapId}: milestone ${milestone} item must be audit_status done, got "${row.audit_status}"`);
    }

    if (requireClosed && row.audit_status === 'open') {
      errors.push(`${gapId}: open item remains when --require-closed`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    rowCount: rows.length,
    headers,
  };
}

/**
 * @param {string} [startDir]
 */
function findRepoRoot(startDir = process.cwd()) {
  let current = startDir;
  while (true) {
    try {
      readFileSync(join(current, 'package.json'), 'utf8');
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return startDir;
      }
      current = parent;
    }
  }
}

/**
 * @param {string} repoRoot
 * @param {string} absPath
 */
function relativePath(repoRoot, absPath) {
  const normalized = absPath.replace(/\\/g, '/');
  const root = repoRoot.replace(/\\/g, '/');
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
}

function runSelfTests() {
  let passed = 0;
  let failed = 0;

  /**
   * @param {string} name
   * @param {() => void} fn
   */
  function test(name, fn) {
    try {
      fn();
      console.log(`ok - ${name}`);
      passed += 1;
    } catch (err) {
      console.error(`not ok - ${name}`);
      console.error(err);
      failed += 1;
    }
  }

  test('audit row missing target_m column fails validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'validate-spec-gap-audit-'));
    mkdirSync(join(root, 'docs', 'workflow'), { recursive: true });
    writeFileSync(
      join(root, DEFAULT_AUDIT),
      `# Audit

| gap_id | category | spec_fr | code_status | gap | e2e_row_id | audit_status |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | platform | FR-01 | missing | missing | E2E-P-017 | open |
`,
      'utf8',
    );

    const result = validateSpecGapAudit({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('missing required column: target_m')));
  });

  test('open partial item without target_m milestone fails validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'validate-spec-gap-audit-'));
    mkdirSync(join(root, 'docs', 'workflow'), { recursive: true });

    const rows = [];
    for (let i = 1; i <= EXPECTED_GAP_COUNT; i += 1) {
      const gapId = expectedGapId(i);
      const targetM = i === 7 ? '—' : 'M-2';
      const gap = i === 7 ? 'partial' : 'missing';
      const auditStatus = i === 7 ? 'open' : 'open';
      rows.push(
        `| ${gapId} | semi-impl | FR-05 | skeleton | ${gap} | ${targetM} | E2E-N-skillRun | ${auditStatus} |`,
      );
    }

    writeFileSync(
      join(root, DEFAULT_AUDIT),
      `# Audit

| gap_id | category | spec_fr | code_status | gap | target_m | e2e_row_id | audit_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`,
      'utf8',
    );

    const result = validateSpecGapAudit({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) =>
        /GAP-007.*open partial item requires concrete target_m/i.test(error),
      ),
    );
  });

  if (failed > 0) {
    console.error(`\n${failed} failed, ${passed} passed`);
    process.exit(1);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    runSelfTests();
    return;
  }

  const milestoneArg = args.find((arg) => arg.startsWith('--milestone='));
  const milestone = milestoneArg
    ? milestoneArg.split('=')[1]
    : args.includes('--milestone')
      ? args[args.indexOf('--milestone') + 1]
      : undefined;

  const result = validateSpecGapAudit({
    milestone,
    requireClosed: args.includes('--require-closed'),
  });

  if (result.ok) {
    console.log(`OK: ${result.rowCount} gap rows (${FIRST_GAP_ID}～${LAST_GAP_ID})`);
    process.exit(0);
  }

  for (const error of result.errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/') === entryPath.replace(/\\/g, '/')) {
  main();
}
