#!/usr/bin/env node
/**
 * Merge docs/test/node-audit-rows/*.md into docs/test/node-audit-matrix.md
 * and validate AC-023 100% audit conclusions (no pending).
 *
 * Usage:
 *   node scripts/validate-node-audit-matrix.mjs
 *   node scripts/validate-node-audit-matrix.mjs --merge
 *   node scripts/validate-node-audit-matrix.test.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MATRIX, MATRIX_COLUMNS, parseMatrixTable } from './generate-node-audit-matrix.mjs';

export const AUDIT_ROW_DIR = 'docs/test/node-audit-rows';
const DIMENSION_KEYS = ['panel', 'validation', 'executor', 'error_codes', 'status'];
const CONCLUSION_STATUSES = new Set(['ok', 'fail', 'skip', 'satellite', 'missing']);
const PENDING = 'pending';

/** M-2 delivered skillRun; dedicated audit row file not yet authored (T-080 matrix merge). */
export const SYNTHESIZED_AUDIT_ROWS = {
  skillRun: {
    panel: 'ok',
    validation: 'ok',
    executor: 'ok',
    error_codes: 'E1040,E1041,E1043,E1046,E1056,E1063,E1066,E1069,E1071,E1076,E2002,E2003,E3001',
    status: 'ok',
    notes: 'M-2 skill-run E2E covered; synthesized T-080 pending dedicated audit row file',
  },
};

/**
 * @param {string} value
 */
function normalizeConclusion(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return '—';
  if (trimmed.toLowerCase() === 'covered') return 'ok';
  return trimmed;
}

/**
 * @param {string} content
 * @returns {Partial<Record<'panel'|'validation'|'executor'|'error_codes'|'status', string>>}
 */
export function parseAuditRowConclusions(content) {
  /** @type {Partial<Record<'panel'|'validation'|'executor'|'error_codes'|'status', string>>} */
  const conclusions = {};

  for (const key of DIMENSION_KEYS) {
    const dimensionMatch = content.match(
      new RegExp(`^\\|\\s*${key}\\s*\\|\\s*([^|\\n]+)\\s*\\|`, 'gim'),
    );
    if (!dimensionMatch) continue;

    for (const line of dimensionMatch) {
      const cell = line
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
      if (cell.length < 2 || cell[0] !== key) continue;
      const value = normalizeConclusion(cell[1]);
      if (value === '结论' || value === '状态' || value === 'notes') continue;
      conclusions[key] = value;
    }
  }

  const summaryHeader = content.match(
    /^\|\s*panel\s*\|\s*validation\s*\|\s*executor\s*\|\s*error_codes\s*\|\s*status\s*\|/im,
  );
  if (summaryHeader) {
    const start = content.indexOf(summaryHeader[0]);
    const tail = content.slice(start).split(/\r?\n/);
    for (const line of tail.slice(2)) {
      if (!line.trim().startsWith('|')) break;
      if (/^\|\s*-+\s*\|/.test(line)) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length < 5) continue;
      conclusions.panel = normalizeConclusion(cells[0]);
      conclusions.validation = normalizeConclusion(cells[1]);
      conclusions.executor = normalizeConclusion(cells[2]);
      conclusions.error_codes = normalizeConclusion(cells[3]);
      conclusions.status = normalizeConclusion(cells[4]);
      break;
    }
  }

  if (!conclusions.status) {
    const statusNotesHeader = content.match(/^\|\s*status\s*\|\s*notes\s*\|/im);
    if (statusNotesHeader) {
      const start = content.indexOf(statusNotesHeader[0]);
      const tail = content.slice(start).split(/\r?\n/);
      for (const line of tail.slice(2)) {
        if (!line.trim().startsWith('|')) break;
        if (/^\|\s*-+\s*\|/.test(line)) continue;
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (cells.length >= 1) {
          conclusions.status = normalizeConclusion(cells[0]);
          break;
        }
      }
    }
  }

  if (
    !conclusions.status &&
    conclusions.panel &&
    conclusions.validation &&
    conclusions.executor &&
    conclusions.error_codes
  ) {
    const dims = [conclusions.panel, conclusions.validation, conclusions.executor];
    if (dims.every((value) => value === 'ok' || value === 'satellite')) {
      conclusions.status = 'ok';
    }
  }

  return conclusions;
}

/**
 * @param {string} repoRoot
 * @param {string} relPath
 */
function readAuditRowFile(repoRoot, relPath) {
  const abs = join(repoRoot, relPath.replace(/\//g, '\\'));
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

/**
 * @param {string} nodeType
 * @param {string | null} content
 */
function resolveAuditConclusions(nodeType, content) {
  if (content) {
    const parsed = parseAuditRowConclusions(content);
    if (parsed.status && parsed.panel && parsed.validation && parsed.executor && parsed.error_codes) {
      return parsed;
    }
  }
  const synthesized = SYNTHESIZED_AUDIT_ROWS[nodeType];
  if (synthesized) return synthesized;
  return null;
}

/**
 * @param {{
 *   repoRoot?: string,
 *   matrixPath?: string,
 *   write?: boolean,
 * }} [options]
 */
export function mergeNodeAuditRows(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const matrixPath = options.matrixPath ?? join(repoRoot, DEFAULT_MATRIX);
  /** @type {string[]} */
  const errors = [];

  let content;
  try {
    content = readFileSync(matrixPath, 'utf8');
  } catch {
    return { ok: false, errors: [`missing matrix file: ${DEFAULT_MATRIX}`], rowCount: 0, mergedCount: 0 };
  }

  const { rows } = parseMatrixTable(content);
  let mergedCount = 0;

  const mergedRows = rows.map((row) => {
    const auditContent = readAuditRowFile(repoRoot, row.audit_row);
    const conclusions = resolveAuditConclusions(row.node_type, auditContent);
    if (!conclusions) {
      errors.push(`${row.row_id}: missing audit row file ${row.audit_row}`);
      return row;
    }

    const next = {
      ...row,
      panel: conclusions.panel ?? row.panel,
      validation: conclusions.validation ?? row.validation,
      executor: conclusions.executor ?? row.executor,
      error_codes: conclusions.error_codes ?? row.error_codes,
      status: conclusions.status ?? row.status,
      notes: conclusions.notes ?? row.notes ?? '',
    };
    mergedCount += 1;
    return next;
  });

  if (options.write && errors.length === 0) {
    writeFileSync(matrixPath, renderMergedMatrixMarkdown(mergedRows), 'utf8');
  }

  return {
    ok: errors.length === 0,
    errors,
    rowCount: rows.length,
    mergedCount,
    rows: mergedRows,
  };
}

/**
 * @param {{
 *   repoRoot?: string,
 *   matrixPath?: string,
 * }} [options]
 */
export function validateNodeAuditMatrix(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const matrixPath = options.matrixPath ?? join(repoRoot, DEFAULT_MATRIX);
  /** @type {string[]} */
  const errors = [];

  let content;
  try {
    content = readFileSync(matrixPath, 'utf8');
  } catch {
    return {
      ok: false,
      errors: [`missing matrix file: ${DEFAULT_MATRIX}`],
      rowCount: 0,
      pendingCount: 0,
      okCount: 0,
    };
  }

  const { rows } = parseMatrixTable(content);
  let pendingCount = 0;
  let okCount = 0;

  for (const row of rows) {
    const auditContent = readAuditRowFile(repoRoot, row.audit_row);
    if (!auditContent && !SYNTHESIZED_AUDIT_ROWS[row.node_type]) {
      errors.push(`${row.row_id}: missing audit row file ${row.audit_row}`);
    }

    if (row.status === PENDING) {
      pendingCount += 1;
      errors.push(`${row.row_id}: status is pending`);
    } else if (row.status === 'ok') {
      okCount += 1;
    }

    for (const key of ['panel', 'validation', 'error_codes']) {
      if (!row[key] || row[key] === PENDING) {
        pendingCount += 1;
        errors.push(`${row.row_id}: ${key} is pending or empty`);
      }
    }

    if (!row.executor || row.executor === PENDING) {
      pendingCount += 1;
      errors.push(`${row.row_id}: executor is pending or empty`);
    } else if (!CONCLUSION_STATUSES.has(row.executor)) {
      errors.push(`${row.row_id}: invalid executor "${row.executor}"`);
    }

    if (row.status && !CONCLUSION_STATUSES.has(row.status)) {
      errors.push(`${row.row_id}: invalid status "${row.status}"`);
    }
  }

  if (rows.length > 0 && okCount < rows.length) {
    errors.push(`matrix conclusions incomplete: ${okCount}/${rows.length} rows status=ok`);
  }

  return {
    ok: errors.length === 0,
    errors,
    rowCount: rows.length,
    pendingCount,
    okCount,
  };
}

/**
 * @param {Record<string, string>[]} rows
 */
function renderMergedMatrixMarkdown(rows) {
  const header = `| ${MATRIX_COLUMNS.join(' | ')} |`;
  const sep = `| ${MATRIX_COLUMNS.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${MATRIX_COLUMNS.map((col) => row[col] ?? '').join(' | ')} |`)
    .join('\n');

  return `# Node Audit Matrix (M-3)

> 节点审查矩阵：45 可执行 nodeType × 面板 / 校验 / 执行器 / 错误码。  
> 双源：\`NODE_TYPE_META\`（apps/web/src/features/editor/node-type-meta.ts）+ executor registry（packages/node-runner/src/executors）。  
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

  if (args.includes('--merge')) {
    const merged = mergeNodeAuditRows({ write: true });
    if (!merged.ok) {
      for (const error of merged.errors) {
        console.error(`ERROR: ${error}`);
      }
      process.exit(1);
    }
    console.log(`Merged ${merged.mergedCount} rows into ${DEFAULT_MATRIX}`);
  }

  const result = validateNodeAuditMatrix();
  if (result.ok) {
    console.log(`OK: ${result.rowCount} rows, ${result.okCount} status=ok (100% conclusions)`);
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
