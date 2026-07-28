#!/usr/bin/env node
/**
 * TDD tests for scripts/validate-node-audit-matrix.mjs (T-080).
 * Run: node scripts/validate-node-audit-matrix.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mergeNodeAuditRows,
  parseAuditRowConclusions,
  validateNodeAuditMatrix,
} from './validate-node-audit-matrix.mjs';

const DEFAULT_MATRIX = 'docs/test/node-audit-matrix.md';
const ROWS_DIR = 'docs/test/node-audit-rows';

function writeMatrix(root, rows) {
  mkdirSync(join(root, 'docs/test'), { recursive: true });
  const header =
    '| row_id | node_type | category | track | panel | validation | executor | error_codes | audit_row | status | notes |';
  const sep = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows
    .map(
      (row) =>
        `| ${row.row_id} | ${row.node_type} | ${row.category} | ${row.track} | ${row.panel} | ${row.validation} | ${row.executor} | ${row.error_codes} | ${row.audit_row} | ${row.status} | ${row.notes ?? ''} |`,
    )
    .join('\n');
  writeFileSync(
    join(root, DEFAULT_MATRIX),
    `# Node Audit Matrix\n\n${header}\n${sep}\n${body}\n`,
    'utf8',
  );
}

function writeAuditRow(root, nodeType, conclusions) {
  mkdirSync(join(root, ROWS_DIR), { recursive: true });
  const lines = [
    `# ${nodeType}`,
    '',
    '| 维度 | 结论 | 证据 |',
    '| --- | --- | --- |',
    `| panel | ${conclusions.panel} | ok |`,
    `| validation | ${conclusions.validation} | ok |`,
    `| executor | ${conclusions.executor} | ok |`,
    `| error_codes | ${conclusions.error_codes} | ok |`,
    `| status | ${conclusions.status} | ok |`,
    '',
  ];
  writeFileSync(join(root, ROWS_DIR, `${nodeType}.md`), lines.join('\n'), 'utf8');
}

let passed = 0;
let failed = 0;

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

test('parseAuditRowConclusions reads dimension table', () => {
  const content = `| 维度 | 结论 | 证据 |
| panel | ok | schema |
| validation | ok | validate |
| executor | satellite | tools |
| error_codes | E2003 | |
| status | ok | done |`;
  const parsed = parseAuditRowConclusions(content);
  assert.equal(parsed.panel, 'ok');
  assert.equal(parsed.validation, 'ok');
  assert.equal(parsed.executor, 'satellite');
  assert.equal(parsed.error_codes, 'E2003');
  assert.equal(parsed.status, 'ok');
});

test('pending audit rows fail validation', () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-node-audit-'));
  writeMatrix(root, [
    {
      row_id: 'AUDIT-N-alpha',
      node_type: 'alpha',
      category: 'action',
      track: 'lite',
      panel: 'pending',
      validation: 'pending',
      executor: 'pending',
      error_codes: 'pending',
      audit_row: 'docs/test/node-audit-rows/alpha.md',
      status: 'pending',
    },
  ]);
  writeAuditRow(root, 'alpha', {
    panel: 'ok',
    validation: 'ok',
    executor: 'ok',
    error_codes: 'E2003',
    status: 'ok',
  });

  const result = validateNodeAuditMatrix({ repoRoot: root });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /pending/i.test(error)),
    `expected pending error, got: ${result.errors.join('; ')}`,
  );
});

test('mergeNodeAuditRows updates matrix from audit row files', () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-node-audit-'));
  writeMatrix(root, [
    {
      row_id: 'AUDIT-N-beta',
      node_type: 'beta',
      category: 'action',
      track: 'lite',
      panel: 'pending',
      validation: 'pending',
      executor: 'pending',
      error_codes: 'pending',
      audit_row: 'docs/test/node-audit-rows/beta.md',
      status: 'pending',
    },
  ]);
  writeAuditRow(root, 'beta', {
    panel: 'ok',
    validation: 'ok',
    executor: 'ok',
    error_codes: 'E2002',
    status: 'ok',
  });

  const merged = mergeNodeAuditRows({ repoRoot: root, write: true });
  assert.equal(merged.ok, true);
  const check = validateNodeAuditMatrix({ repoRoot: root });
  assert.equal(check.ok, true);
  assert.equal(check.pendingCount, 0);
  assert.equal(check.okCount, 1);
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
