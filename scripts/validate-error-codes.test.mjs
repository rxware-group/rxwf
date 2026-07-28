#!/usr/bin/env node
/**
 * TDD tests for scripts/validate-error-codes.mjs (T-082).
 * Run: node scripts/validate-error-codes.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_AUDIT_ROWS_DIR,
  DEFAULT_ERROR_CODES,
  validateErrorCodes,
} from './validate-error-codes.mjs';

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

function writeFixture(root, { errorCodes, auditRows }) {
  mkdirSync(join(root, 'docs', 'test', 'node-audit-rows'), { recursive: true });
  writeFileSync(join(root, DEFAULT_ERROR_CODES), errorCodes, 'utf8');
  for (const [name, body] of Object.entries(auditRows)) {
    writeFileSync(join(root, DEFAULT_AUDIT_ROWS_DIR, name), body, 'utf8');
  }
  writeFileSync(join(root, 'package.json'), '{"name":"fixture"}', 'utf8');
}

test('node E2xx not documented in error-codes.md fails validation', () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-error-codes-'));
  writeFixture(root, {
    errorCodes: `# Error codes

## E2xxx 执行

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E2003 | 节点执行失败 | 查看日志 |

## 节点失败码映射

| nodeType | E2xxx | 场景摘要 | 审查行 |
|----------|-------|----------|--------|
| \`if\` | E2003 | 空条件 | [if.md](test/node-audit-rows/if.md) |
`,
    auditRows: {
      'if.md': `| error_codes | E2003, E2099 |`,
      'postgres.md': `| error_codes | E2002, E2003 |`,
    },
  });

  const result = validateErrorCodes({ repoRoot: root });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes('E2099')),
    `expected E2099 undocumented error, got: ${result.errors.join('; ')}`,
  );
  assert.ok(
    result.errors.some((e) => e.includes('postgres')),
    `expected postgres mapping gap, got: ${result.errors.join('; ')}`,
  );
});

test('fully documented node E2xx and mapping passes validation', () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-error-codes-'));
  writeFixture(root, {
    errorCodes: `# Error codes

## E2xxx 执行

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E2002 | 参数或执行错误 | 检查节点参数 |
| E2003 | 节点执行失败 | 查看日志 |

## 节点失败码映射

| nodeType | E2xxx | 场景摘要 | 审查行 |
|----------|-------|----------|--------|
| \`if\` | E2003 | 空条件表达式 | [if.md](test/node-audit-rows/if.md) |
| \`postgres\` | E2002, E2003 | 空白 query / 无连接 | [postgres.md](test/node-audit-rows/postgres.md) |
`,
    auditRows: {
      'if.md': `| error_codes | E2003 |`,
      'postgres.md': `| error_codes | E2002, E2003 |`,
    },
  });

  const result = validateErrorCodes({ repoRoot: root });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('repo error-codes.md passes validation', () => {
  const result = validateErrorCodes();
  assert.equal(result.ok, true, result.errors.join('\n'));
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
