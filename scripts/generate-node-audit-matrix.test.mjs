#!/usr/bin/env node
/**
 * Unit tests for scripts/generate-node-audit-matrix.mjs (T-034).
 * Run: node scripts/generate-node-audit-matrix.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  REQUIRED_NODE_TYPE_COUNT,
  checkNodeAuditMatrix,
  generateNodeAuditMatrix,
} from './generate-node-audit-matrix.mjs';

const NODE_TYPE_META_PATH = 'apps/web/src/features/editor/node-type-meta.ts';
const SATELLITE_PATH = 'packages/workflow/src/agent-satellites.ts';
const DEFAULT_MATRIX = 'docs/test/node-audit-matrix.md';

function writeMeta(root, types) {
  const abs = join(root, NODE_TYPE_META_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  const body = types.map((t) => `  ${t}: { label: '${t}', category: 'action', icon: '●', accent: '#000', description: '' },`).join('\n');
  writeFileSync(
    abs,
    `export const NODE_TYPE_META = {\n${body}\n  stickyNote: {},\n};\n`,
    'utf8',
  );
}

function writeSatellites(root, types) {
  const abs = join(root, SATELLITE_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  const body = types.map((t) => `'${t}'`).join(', ');
  writeFileSync(
    abs,
    `export const SATELLITE_NODE_TYPES = new Set([${body}]);\n`,
    'utf8',
  );
}

function writeExecutorStub(root, types) {
  const dir = join(root, 'packages/node-runner/src/executors');
  mkdirSync(dir, { recursive: true });
  const body = types
    .map(
      (t) => `export const ${t}Executor = {
  type: '${t}',
  async execute() {
    return { status: 'success', outputItems: [[]] };
  },
};`,
    )
    .join('\n\n');
  writeFileSync(join(dir, 'fixture-executors.ts'), body, 'utf8');
  writeFileSync(
    join(dir, 'register-builtin.ts'),
    `${types.map((t) => `import { ${t}Executor } from './fixture-executors.js';`).join('\n')}
import type { ExecutorRegistry } from '../registry/executor-registry.js';
export function registerBuiltinExecutors(registry) {
  for (const ex of [${types.map((t) => `${t}Executor`).join(', ')}]) registry.register(ex);
}
`,
    'utf8',
  );
  writeFileSync(
    join(dir, 'register-plus.ts'),
    `import type { ExecutorRegistry } from '../registry/executor-registry.js';
export function registerPlusExecutors(registry) {}
`,
    'utf8',
  );
  writeFileSync(
    join(dir, 'register-skill.ts'),
    `import type { ExecutorRegistry } from '../registry/executor-registry.js';
export function registerSkillExecutors(registry) {}
`,
    'utf8',
  );
}

function writeMatrix(root, rows) {
  mkdirSync(join(root, 'docs/test'), { recursive: true });
  const header = '| row_id | node_type | category | track | panel | validation | executor | error_codes | audit_row | status | notes |';
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

function createFixture({ metaTypes, executorTypes, satelliteTypes = [], matrixRows }) {
  const root = mkdtempSync(join(tmpdir(), 'node-audit-matrix-'));
  writeMeta(root, metaTypes);
  writeSatellites(root, satelliteTypes);
  writeExecutorStub(root, executorTypes);
  writeMatrix(root, matrixRows);
  return root;
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

test('matrix row count !== canonical node type count fails validation', () => {
  const types = Array.from({ length: REQUIRED_NODE_TYPE_COUNT }, (_, i) => `node${i}`);
  const root = createFixture({
    metaTypes: types,
    executorTypes: types,
    matrixRows: types.slice(0, REQUIRED_NODE_TYPE_COUNT - 1).map((node_type) => ({
      row_id: `AUDIT-N-${node_type}`,
      node_type,
      category: 'action',
      track: 'lite',
      panel: 'pending',
      validation: 'pending',
      executor: 'pending',
      error_codes: 'pending',
      audit_row: `docs/test/node-audit-rows/${node_type}.md`,
      status: 'pending',
    })),
  });

  const result = checkNodeAuditMatrix({ repoRoot: root });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /row count|行数|!==|missing node row|AUDIT-N-node44/i.test(error)),
    `expected row count error, got: ${result.errors.join('; ')}`,
  );
});

test('executor registry inconsistent with meta fails validation', () => {
  const metaTypes = ['alpha', 'beta'];
  const root = createFixture({
    metaTypes,
    executorTypes: ['alpha'],
    matrixRows: metaTypes.map((node_type) => ({
      row_id: `AUDIT-N-${node_type}`,
      node_type,
      category: 'action',
      track: 'lite',
      panel: 'pending',
      validation: 'pending',
      executor: node_type === 'beta' ? 'pending' : 'pending',
      error_codes: 'pending',
      audit_row: `docs/test/node-audit-rows/${node_type}.md`,
      status: 'pending',
    })),
  });

  const result = checkNodeAuditMatrix({ repoRoot: root });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => /executor|registry|beta|missing executor/i.test(error)),
    `expected executor mismatch error, got: ${result.errors.join('; ')}`,
  );
});

test('generate produces editable matrix aligned with dual sources', () => {
  const repoRoot = process.cwd();
  const result = generateNodeAuditMatrix({ repoRoot, write: true });
  assert.equal(result.ok, true);
  assert.ok(result.rowCount >= REQUIRED_NODE_TYPE_COUNT);
  const content = readFileSync(join(repoRoot, DEFAULT_MATRIX), 'utf8');
  assert.match(content, /\| row_id \| node_type \| category \| track \| panel \| validation \| executor \| error_codes \|/);
  assert.match(content, /AUDIT-N-manualTrigger/);
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
