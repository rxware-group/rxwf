#!/usr/bin/env node
/**
 * Generate / validate docs/test/node-audit-matrix.md from dual sources:
 * - apps/web/src/features/editor/node-type-meta.ts (NODE_TYPE_META)
 * - packages/node-runner executor registrations + satellite types
 *
 * Usage:
 *   node scripts/generate-node-audit-matrix.mjs
 *   node scripts/generate-node-audit-matrix.mjs --check
 *   node scripts/generate-node-audit-matrix.test.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** AC-023 documented target (~45 executable node types excluding stickyNote). */
export const REQUIRED_NODE_TYPE_COUNT = 45;

export const DEFAULT_MATRIX = 'docs/test/node-audit-matrix.md';
const NODE_TYPE_META_PATH = 'apps/web/src/features/editor/node-type-meta.ts';
const SATELLITE_PATH = 'packages/workflow/src/agent-satellites.ts';
const EXECUTOR_ROOT = 'packages/node-runner/src/executors';
const REGISTER_FILES = [
  join(EXECUTOR_ROOT, 'register-builtin.ts'),
  join(EXECUTOR_ROOT, 'register-plus.ts'),
  join(EXECUTOR_ROOT, 'register-skill.ts'),
];

export const MATRIX_COLUMNS = [
  'row_id',
  'node_type',
  'category',
  'track',
  'panel',
  'validation',
  'executor',
  'error_codes',
  'audit_row',
  'status',
  'notes',
];

const VALID_AUDIT_STATUSES = new Set(['pending', 'ok', 'fail', 'skip', 'satellite']);

/** E2E track assignment aligned with docs/test/e2e-coverage-matrix.md. */
const TRACK_BY_NODE_TYPE = {
  manualTrigger: 'lite',
  webhookTrigger: 'standard',
  scheduleTrigger: 'standard',
  errorTrigger: 'standard',
  subworkflowTrigger: 'plus',
  httpRequest: 'lite',
  if: 'lite',
  switch: 'lite',
  merge: 'lite',
  loop: 'lite',
  set: 'lite',
  json: 'lite',
  wait: 'lite',
  humanApproval: 'lite',
  code: 'lite',
  executeCommand: 'standard',
  executeWorkflow: 'standard',
  splitInBatches: 'plus',
  readWriteFile: 'plus',
  postgres: 'standard',
  llm: 'plus',
  llmStream: 'plus',
  ragRetrieve: 'plus',
  ragAnswer: 'plus',
  mcpClient: 'plus',
  crewSequential: 'plus',
  crewHierarchical: 'plus',
  crewSupervisor: 'plus',
  groupChat: 'plus',
  aiAgent: 'plus',
  aiChatModel: 'plus',
  aiMemory: 'plus',
  aiKnowledge: 'plus',
  aiOutputParser: 'plus',
  toolMcp: 'plus',
  toolHttp: 'plus',
  toolWorkflow: 'plus',
  toolSkill: 'plus',
  toolSubagent: 'plus',
  toolRead: 'plus',
  toolWrite: 'plus',
  toolGrep: 'plus',
  toolShell: 'plus',
  toolWebSearch: 'plus',
  skillRun: 'plus',
  workflow_run: 'plus',
};

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
 * @param {string} repoRoot
 * @returns {Set<string>}
 */
export function loadSatelliteNodeTypes(repoRoot) {
  const content = readFileSync(join(repoRoot, SATELLITE_PATH), 'utf8');
  const match = content.match(/SATELLITE_NODE_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!match) return new Set();
  const types = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return new Set(types);
}

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function extractExecutorTypesFromFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  /** @type {string[]} */
  const types = [];

  for (const match of content.matchAll(
    /(?:export const \w+Executor\s*=\s*\{|return\s*\{\s*\n\s*type:\s*'([^']+)'|^\s+type:\s*'([^']+)',\s*\n\s*async execute)/gm,
  )) {
    const type = match[1] ?? match[2];
    if (type) types.push(type);
  }

  for (const match of content.matchAll(/create\w+Executor\([^)]*\)\s*\{[\s\S]*?type:\s*'([^']+)'/g)) {
    types.push(match[1]);
  }

  return types;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listExecutorSourceFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...listExecutorSourceFiles(abs));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue;
    files.push(abs);
  }
  return files;
}

/**
 * Resolve executor module paths referenced by register-*.ts imports.
 * @param {string} repoRoot
 * @returns {Set<string>}
 */
function resolveRegisteredExecutorFiles(repoRoot) {
  /** @type {Set<string>} */
  const files = new Set();
  for (const rel of REGISTER_FILES) {
    const abs = join(repoRoot, rel);
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const match of content.matchAll(/from '\.\/([^']+\.js)';/g)) {
      const tsPath = join(repoRoot, EXECUTOR_ROOT, match[1].replace(/\.js$/, '.ts'));
      files.add(tsPath);
    }
    files.add(abs);
  }
  return files;
}

/**
 * @param {string} repoRoot
 * @param {Set<string>} metaTypes
 * @returns {Set<string>}
 */
export function loadExecutorRegistryTypes(repoRoot, metaTypes) {
  const registeredFiles = resolveRegisteredExecutorFiles(repoRoot);
  const allFiles = listExecutorSourceFiles(join(repoRoot, EXECUTOR_ROOT));
  /** @type {Set<string>} */
  const types = new Set();

  for (const file of allFiles) {
    if (!registeredFiles.has(file) && !file.endsWith('register-plus.ts')) continue;
    for (const type of extractExecutorTypesFromFile(file)) {
      if (metaTypes.has(type)) types.add(type);
    }
  }

  return types;
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
    if (/^\|\s*row_id\s*\|\s*node_type\s*\|/i.test(line)) {
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

  /** @type {Record<string, string>[]} */
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
 * @param {string} nodeType
 */
function auditRowId(nodeType) {
  return `AUDIT-N-${nodeType}`;
}

/**
 * @param {string} repoRoot
 * @param {string} nodeType
 */
function loadNodeCategory(repoRoot, nodeType) {
  const content = readFileSync(join(repoRoot, NODE_TYPE_META_PATH), 'utf8');
  const match = content.match(new RegExp(`\\s+${nodeType}:\\s*\\{[\\s\\S]*?category:\\s*'([^']+)'`));
  return match?.[1] ?? 'action';
}

/**
 * @param {string} nodeType
 * @param {Set<string>} executorTypes
 * @param {Set<string>} satelliteTypes
 */
function defaultExecutorStatus(nodeType, executorTypes, satelliteTypes) {
  if (satelliteTypes.has(nodeType)) return 'satellite';
  if (executorTypes.has(nodeType)) return 'pending';
  return 'missing';
}

/**
 * @param {{
 *   repoRoot?: string,
 *   matrixPath?: string,
 *   write?: boolean,
 *   preserveExisting?: boolean,
 * }} [options]
 */
export function generateNodeAuditMatrix(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const matrixPath = options.matrixPath ?? join(repoRoot, DEFAULT_MATRIX);
  const metaTypes = loadExecutableNodeTypes(repoRoot);
  const metaSet = new Set(metaTypes);
  const satelliteTypes = loadSatelliteNodeTypes(repoRoot);
  const executorTypes = loadExecutorRegistryTypes(repoRoot, metaSet);

  const dualSource = validateDualSources(metaTypes, executorTypes, satelliteTypes);
  if (!dualSource.ok) {
    return {
      ok: false,
      errors: dualSource.errors,
      rowCount: 0,
      nodeTypes: metaTypes,
      written: false,
    };
  }

  let existingByNodeType = new Map();
  if (options.preserveExisting !== false) {
    try {
      const existing = readFileSync(matrixPath, 'utf8');
      const { rows } = parseMatrixTable(existing);
      existingByNodeType = new Map(rows.map((row) => [row.node_type, row]));
    } catch {
      // fresh generate
    }
  }

  /** @type {Record<string, string>[]} */
  const rows = metaTypes.map((nodeType) => {
    const existing = existingByNodeType.get(nodeType);
    const executorStatus =
      existing?.executor && existing.executor !== 'pending'
        ? existing.executor
        : defaultExecutorStatus(nodeType, executorTypes, satelliteTypes);

    return {
      row_id: auditRowId(nodeType),
      node_type: nodeType,
      category: loadNodeCategory(repoRoot, nodeType),
      track: TRACK_BY_NODE_TYPE[nodeType] ?? 'lite',
      panel: existing?.panel ?? 'pending',
      validation: existing?.validation ?? 'pending',
      executor: executorStatus,
      error_codes: existing?.error_codes ?? 'pending',
      audit_row: existing?.audit_row ?? `docs/test/node-audit-rows/${nodeType}.md`,
      status: existing?.status ?? 'pending',
      notes: existing?.notes ?? '',
    };
  });

  const markdown = renderMatrixMarkdown(rows);
  if (options.write) {
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, markdown, 'utf8');
  }

  return {
    ok: true,
    errors: [],
    rowCount: rows.length,
    nodeTypes: metaTypes,
    written: Boolean(options.write),
    markdown,
  };
}

/**
 * @param {Record<string, string>[]} rows
 */
function renderMatrixMarkdown(rows) {
  const header = `| ${MATRIX_COLUMNS.join(' | ')} |`;
  const sep = `| ${MATRIX_COLUMNS.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${MATRIX_COLUMNS.map((col) => row[col] ?? '').join(' | ')} |`)
    .join('\n');

  return `# Node Audit Matrix (M-3)

> 节点审查矩阵：45 可执行 nodeType × 面板 / 校验 / 执行器 / 错误码。  
> 双源：\`NODE_TYPE_META\`（${NODE_TYPE_META_PATH}）+ executor registry（${EXECUTOR_ROOT}）。  
> 卫星节点（\`SATELLITE_NODE_TYPES\`）无独立 executor，\`executor\` 列标 \`satellite\`。  
> 逐 type 审查结论写入 \`docs/test/node-audit-rows/<type>.md\`，M-3 收口合并至本表（T-080）。

## 列定义

| 列 | 说明 |
| --- | --- |
| row_id | 唯一行 ID（AUDIT-N-{nodeType}） |
| node_type | 可执行节点 type（不含 stickyNote） |
| category | NODE_TYPE_META.category |
| track | E2E 轨：lite / standard / plus |
| panel | 属性面板审查：pending / ok / fail |
| validation | 保存校验审查：pending / ok / fail |
| executor | 执行器注册：pending / ok / fail / satellite / missing |
| error_codes | 失败错误码文档化：pending / 逗号分隔 E 码 |
| audit_row | 单行审查记录路径 |
| status | 汇总：pending / ok / fail / skip |
| notes | 自由备注 |

## 矩阵

${header}
${sep}
${body}
`;
}

/**
 * @param {string[]} metaTypes
 * @param {Set<string>} executorTypes
 * @param {Set<string>} satelliteTypes
 */
export function validateDualSources(metaTypes, executorTypes, satelliteTypes) {
  /** @type {string[]} */
  const errors = [];
  const metaSet = new Set(metaTypes);

  for (const type of metaTypes) {
    if (satelliteTypes.has(type)) continue;
    if (!executorTypes.has(type)) {
      errors.push(`missing executor for meta node type: ${type}`);
    }
  }

  for (const type of executorTypes) {
    if (!metaSet.has(type)) {
      errors.push(`executor registry type not in NODE_TYPE_META: ${type}`);
    }
  }

  for (const type of satelliteTypes) {
    if (!metaSet.has(type)) {
      errors.push(`satellite type not in NODE_TYPE_META: ${type}`);
    }
  }

  const covered = new Set([...executorTypes, ...satelliteTypes]);
  for (const type of metaTypes) {
    if (!covered.has(type)) {
      errors.push(`meta node type neither executor nor satellite: ${type}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {{
 *   repoRoot?: string,
 *   matrixPath?: string,
 * }} [options]
 */
export function checkNodeAuditMatrix(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const matrixPath = options.matrixPath ?? join(repoRoot, DEFAULT_MATRIX);
  /** @type {string[]} */
  const errors = [];

  const metaTypes = loadExecutableNodeTypes(repoRoot);
  const metaSet = new Set(metaTypes);
  const satelliteTypes = loadSatelliteNodeTypes(repoRoot);
  const executorTypes = loadExecutorRegistryTypes(repoRoot, metaSet);

  const dualSource = validateDualSources(metaTypes, executorTypes, satelliteTypes);
  errors.push(...dualSource.errors);

  let content;
  try {
    content = readFileSync(matrixPath, 'utf8');
  } catch {
    return {
      ok: false,
      errors: [`missing matrix file: ${DEFAULT_MATRIX}`, ...errors],
      rowCount: 0,
      nodeTypes: metaTypes,
    };
  }

  const { headers, rows } = parseMatrixTable(content);
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));
  for (const column of MATRIX_COLUMNS) {
    if (!headerSet.has(column)) {
      errors.push(`missing required column: ${column}`);
    }
  }

  if (rows.length !== metaTypes.length) {
    errors.push(
      `matrix row count ${rows.length} !== canonical node type count ${metaTypes.length} (expected ${REQUIRED_NODE_TYPE_COUNT} per AC-023)`,
    );
  }

  const rowByNodeType = new Map(rows.map((row) => [row.node_type, row]));
  for (const nodeType of metaTypes) {
    const row = rowByNodeType.get(nodeType);
    if (!row) {
      errors.push(`missing matrix row for node type: ${nodeType}`);
      continue;
    }
    if (row.row_id !== auditRowId(nodeType)) {
      errors.push(`${row.row_id}: row_id must be ${auditRowId(nodeType)}`);
    }
    if (row.node_type !== nodeType) {
      errors.push(`${row.row_id}: node_type must be ${nodeType}`);
    }
    if (!row.audit_row) {
      errors.push(`${row.row_id}: audit_row is required`);
    }
    if (!VALID_AUDIT_STATUSES.has(row.status)) {
      errors.push(`${row.row_id}: invalid status "${row.status}"`);
    }
  }

  for (const row of rows) {
    if (!metaSet.has(row.node_type)) {
      errors.push(`unexpected matrix row for unknown node type: ${row.node_type}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    rowCount: rows.length,
    nodeTypes: metaTypes,
    executorTypes: [...executorTypes].sort(),
    satelliteTypes: [...satelliteTypes].sort(),
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

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');

  if (checkOnly) {
    const result = checkNodeAuditMatrix();
    if (result.ok) {
      console.log(
        `OK: ${result.rowCount} rows (${result.nodeTypes.length} nodeType; executor=${result.executorTypes.length}, satellite=${result.satelliteTypes.length})`,
      );
      process.exit(0);
    }
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exit(1);
  }

  const result = generateNodeAuditMatrix({ write: true });
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exit(1);
  }

  const check = checkNodeAuditMatrix();
  if (!check.ok) {
    for (const error of check.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exit(1);
  }

  console.log(`Wrote ${DEFAULT_MATRIX}: ${result.rowCount} rows`);
  process.exit(0);
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1].replace(/\\/g, '/') === entryPath.replace(/\\/g, '/')) {
  main();
}
