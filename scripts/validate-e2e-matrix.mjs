#!/usr/bin/env node
/**
 * Validates docs/test/e2e-coverage-matrix.md against v2.0 full-feature row requirements.
 * Usage:
 *   node scripts/validate-e2e-matrix.mjs
 *   node scripts/validate-e2e-matrix.mjs --test
 *   node scripts/validate-e2e-matrix.mjs --require-full
 *   node scripts/validate-e2e-matrix.mjs --nodes
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DEFAULT_MATRIX = 'docs/test/e2e-coverage-matrix.md';
const NODE_TYPE_META_PATH = 'apps/web/src/features/editor/node-type-meta.ts';

/** Required table columns (AC-008 + NFR-04 track). */
export const REQUIRED_COLUMNS = [
  'row_id',
  'description',
  'spec_fr',
  'node_type',
  'e2e_spec',
  'status',
  'track',
];

/** Non-node platform capabilities required beyond 45 executable node types. */
export const PLATFORM_CAPABILITY_ROWS = [
  {
    id: 'E2E-P-001',
    slug: 'editor-workflow-crud',
    description: '编辑器：创建工作流、拖拽节点、保存',
    specFr: 'FR-1',
    track: 'lite',
  },
  {
    id: 'E2E-P-002',
    slug: 'editor-connection-validation',
    description: '编辑器：连线校验与环路检测',
    specFr: 'FR-1',
    track: 'lite',
  },
  {
    id: 'E2E-P-003',
    slug: 'execution-manual-trigger',
    description: '执行：手动触发与状态轮询',
    specFr: 'FR-3',
    track: 'lite',
  },
  {
    id: 'E2E-P-004',
    slug: 'execution-history',
    description: '执行：历史列表与节点详情',
    specFr: 'FR-3',
    track: 'lite',
  },
  {
    id: 'E2E-P-005',
    slug: 'execution-error-workflow',
    description: '执行：Error Workflow 触发链',
    specFr: 'FR-3',
    track: 'standard',
  },
  {
    id: 'E2E-P-006',
    slug: 'execution-partial-debug',
    description: '调试：Partial/Pin/Dirty 执行',
    specFr: 'FR-11',
    track: 'lite',
  },
  {
    id: 'E2E-P-007',
    slug: 'help-routing',
    description: '帮助：路由与 Markdown 渲染',
    specFr: 'FR-6',
    track: 'lite',
  },
  {
    id: 'E2E-P-008',
    slug: 'help-node-editor-jump',
    description: '帮助：编辑器节点帮助按钮跳转',
    specFr: 'FR-8',
    track: 'lite',
  },
  {
    id: 'E2E-P-009',
    slug: 'auth-login',
    description: '认证：登录与会话',
    specFr: 'FR-6',
    track: 'lite',
  },
  {
    id: 'E2E-P-010',
    slug: 'settings-env-vars',
    description: '设置：全局/工作流环境变量',
    specFr: 'FR-4',
    track: 'lite',
  },
  {
    id: 'E2E-P-011',
    slug: 'settings-credentials',
    description: '凭证：创建与引用',
    specFr: 'FR-10',
    track: 'standard',
  },
  {
    id: 'E2E-P-012',
    slug: 'workflow-import-export',
    description: '工作流：JSON 导入导出',
    specFr: 'FR-7',
    track: 'lite',
  },
  {
    id: 'E2E-P-013',
    slug: 'subworkflow-nesting',
    description: '子工作流：嵌套调用与深度限制',
    specFr: 'FR-5',
    track: 'standard',
  },
  {
    id: 'E2E-P-014',
    slug: 'binary-full-chain',
    description: 'Binary：上传/下载/表达式全链路',
    specFr: 'M-5 Binary',
    track: 'standard',
  },
  {
    id: 'E2E-P-015',
    slug: 'mcp-server-ide',
    description: 'MCP Server：AI IDE 反控工作流',
    specFr: 'FR-IDE',
    track: 'standard',
  },
  {
    id: 'E2E-P-016',
    slug: 'runner-management',
    description: 'Runner：注册、心跳与调度',
    specFr: 'FR-23',
    track: 'standard',
  },
  {
    id: 'E2E-P-017',
    slug: 'docs-index-navigation',
    description: '文档：INDEX 导航与索引 CI',
    specFr: 'FR-01',
    track: 'lite',
  },
  {
    id: 'E2E-P-018',
    slug: 'workflow-acl',
    description: '工作流 ACL：协作者权限',
    specFr: 'FR-6',
    track: 'standard',
  },
  {
    id: 'E2E-P-019',
    slug: 'webhook-http-api',
    description: 'Webhook：HTTP 触发 API',
    specFr: 'FR-2',
    track: 'standard',
  },
];

const VALID_STATUSES = new Set(['uncovered', 'covered', 'skip']);
const VALID_TRACKS = new Set(['lite', 'standard', 'plus', 'any']);

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function loadExecutableNodeTypes(repoRoot) {
  const content = readFileSync(join(repoRoot, NODE_TYPE_META_PATH), 'utf8');
  const keys = [...content.matchAll(/^\s+(\w+):\s*\{/gm)].map((match) => match[1]);
  return keys.filter((key) => key !== 'stickyNote').sort();
}

/**
 * @param {string} content
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseMatrixTable(content) {
  const lines = content.split(/\r?\n/);
  let headerLine = null;
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    if (/^\|\s*row_id\s*\|\s*description\s*\|/i.test(line)) {
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
 * @param {Record<string, string>} row
 * @returns {string}
 */
function nodeRowId(nodeType) {
  return `E2E-N-${nodeType}`;
}

/**
 * @param {{
 *   repoRoot?: string,
 *   matrixPath?: string,
 *   requireFull?: boolean,
 *   nodesOnly?: boolean,
 * }} [options]
 */
export function validateE2eMatrix(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const matrixPath = options.matrixPath ?? join(repoRoot, DEFAULT_MATRIX);
  const requireFull = options.requireFull ?? false;
  const nodesOnly = options.nodesOnly ?? false;

  /** @type {string[]} */
  const errors = [];

  let content;
  try {
    content = readFileSync(matrixPath, 'utf8');
  } catch {
    return {
      ok: false,
      errors: [`missing matrix file: ${relativePath(repoRoot, matrixPath)}`],
      rowCount: 0,
      nodeTypes: [],
      platformRows: [],
    };
  }

  const { headers, rows } = parseMatrixTable(content);
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));

  for (const column of REQUIRED_COLUMNS) {
    if (!headerSet.has(column)) {
      errors.push(`missing required column: ${column}`);
    }
  }

  const expectedNodeTypes = loadExecutableNodeTypes(repoRoot);
  const expectedPlatformIds = PLATFORM_CAPABILITY_ROWS.map((row) => row.id);
  const rowById = new Map(rows.map((row) => [row.row_id, row]));

  for (const nodeType of expectedNodeTypes) {
    const id = nodeRowId(nodeType);
    const row = rowById.get(id);
    if (!row) {
      errors.push(`missing node row: ${id}`);
      continue;
    }
    if (row.node_type !== nodeType) {
      errors.push(`${id}: node_type must be ${nodeType}, got "${row.node_type}"`);
    }
    if (!row.description) {
      errors.push(`${id}: description is required`);
    }
    if (!row.spec_fr) {
      errors.push(`${id}: spec_fr is required`);
    }
    if (!VALID_TRACKS.has(row.track)) {
      errors.push(`${id}: invalid track "${row.track}"`);
    }
    if (!VALID_STATUSES.has(row.status)) {
      errors.push(`${id}: invalid status "${row.status}"`);
    }
    if (requireFull && row.status !== 'covered') {
      errors.push(`${id}: status must be covered when --require-full`);
    }
    if (nodesOnly && row.status !== 'covered') {
      errors.push(`${id}: node row status must be covered when --nodes`);
    }
  }

  if (!nodesOnly) {
    for (const platformRow of PLATFORM_CAPABILITY_ROWS) {
      const row = rowById.get(platformRow.id);
      if (!row) {
        errors.push(`missing platform row: ${platformRow.id}`);
        continue;
      }
      if (row.node_type && row.node_type !== '—' && row.node_type !== '-') {
        errors.push(`${platformRow.id}: platform row node_type must be empty or —`);
      }
      if (!row.description) {
        errors.push(`${platformRow.id}: description is required`);
      }
      if (!row.spec_fr) {
        errors.push(`${platformRow.id}: spec_fr is required`);
      }
      if (!VALID_TRACKS.has(row.track)) {
        errors.push(`${platformRow.id}: invalid track "${row.track}"`);
      }
      if (!VALID_STATUSES.has(row.status)) {
        errors.push(`${platformRow.id}: invalid status "${row.status}"`);
      }
      if (requireFull && row.status !== 'covered') {
        errors.push(`${platformRow.id}: status must be covered when --require-full`);
      }
    }
  }

  const minRows = expectedNodeTypes.length + (nodesOnly ? 0 : PLATFORM_CAPABILITY_ROWS.length);
  if (rows.length < minRows) {
    errors.push(
      `row count ${rows.length} < required ${minRows} (${expectedNodeTypes.length} nodeType + ${nodesOnly ? 0 : PLATFORM_CAPABILITY_ROWS.length} platform capabilities)`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    rowCount: rows.length,
    nodeTypes: expectedNodeTypes,
    platformRows: expectedPlatformIds,
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

  test('incomplete matrix (< 45 nodeType + platform capabilities) fails validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'validate-e2e-matrix-'));
    mkdirSync(join(root, 'docs', 'test'), { recursive: true });
    mkdirSync(join(root, 'apps', 'web', 'src', 'features', 'editor'), { recursive: true });
    writeFileSync(
      join(root, NODE_TYPE_META_PATH),
      `export const NODE_TYPE_META = {
  manualTrigger: {},
  webhookTrigger: {},
  stickyNote: {},
};`,
      'utf8',
    );
    writeFileSync(
      join(root, DEFAULT_MATRIX),
      `# Matrix

| row_id | description | spec_fr | node_type | e2e_spec | status | track |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-N-manualTrigger | Manual trigger | FR-2 | manualTrigger | | uncovered | lite |
`,
      'utf8',
    );

    const result = validateE2eMatrix({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => /missing node row|E2E-N-webhookTrigger|row count/i.test(error)));
  });

  test('missing track column fails validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'validate-e2e-matrix-'));
    mkdirSync(join(root, 'docs', 'test'), { recursive: true });
    mkdirSync(join(root, 'apps', 'web', 'src', 'features', 'editor'), { recursive: true });
    writeFileSync(
      join(root, NODE_TYPE_META_PATH),
      `export const NODE_TYPE_META = {
  manualTrigger: {},
  stickyNote: {},
};`,
      'utf8',
    );
    writeFileSync(
      join(root, DEFAULT_MATRIX),
      `# Matrix

| row_id | description | spec_fr | node_type | e2e_spec | status |
| --- | --- | --- | --- | --- | --- |
| E2E-N-manualTrigger | Manual trigger | FR-2 | manualTrigger | | uncovered |
`,
      'utf8',
    );

    const result = validateE2eMatrix({ repoRoot: root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('missing required column: track')));
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

  const result = validateE2eMatrix({
    requireFull: args.includes('--require-full'),
    nodesOnly: args.includes('--nodes'),
  });

  if (result.ok) {
    console.log(
      `OK: ${result.rowCount} rows (${result.nodeTypes.length} nodeType + ${result.platformRows.length} platform capabilities)`,
    );
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
