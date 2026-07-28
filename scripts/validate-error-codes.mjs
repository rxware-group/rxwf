#!/usr/bin/env node
/**
 * Validates docs/error-codes.md against node audit rows (AC-030 / T-082).
 * - Every E2xx referenced in docs/test/node-audit-rows/*.md must appear in error-codes.md.
 * - The node failure mapping table must list each nodeType that emits E2xx.
 *
 * Usage:
 *   node scripts/validate-error-codes.mjs
 *   node scripts/validate-error-codes.test.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ERROR_CODES = 'docs/error-codes.md';
export const DEFAULT_AUDIT_ROWS_DIR = 'docs/test/node-audit-rows';
export const NODE_MAPPING_HEADING = '## 节点失败码映射';

const E2_CODE_RE = /\bE20\d{2}\b/g;
const E2_TABLE_ROW_RE = /^\|\s*(E20\d{2})\s*\|/;

/**
 * @param {string} [startDir]
 */
export function findRepoRoot(startDir = process.cwd()) {
  let current = startDir;
  while (true) {
    try {
      readFileSync(join(current, 'package.json'), 'utf8');
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) return startDir;
      current = parent;
    }
  }
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
export function extractE2CodesFromText(content) {
  const codes = new Set();
  for (const match of content.matchAll(E2_CODE_RE)) {
    codes.add(match[0]);
  }
  return codes;
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
export function extractDocumentedE2Codes(content) {
  const codes = new Set();
  for (const line of content.split(/\r?\n/)) {
    const row = line.match(E2_TABLE_ROW_RE);
    if (row) codes.add(row[1]);
    // Footnote rows like "| E2002† |" in editor section
    const foot = line.match(/^\|\s*(E20\d{2})†\s*\|/);
    if (foot) codes.add(foot[1]);
  }
  return codes;
}

/**
 * @param {string} filename e.g. toolWebSearch.md
 */
function nodeTypeFromAuditFilename(filename) {
  return filename.replace(/\.md$/i, '');
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
function extractErrorCodesColumn(content) {
  const codes = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\|\s*error_codes\s*\|\s*([^|]+)\|/i);
    if (!match) continue;
    const cell = match[1].trim();
    if (!cell || cell === '—' || cell === '-') continue;
    for (const code of cell.matchAll(E2_CODE_RE)) {
      codes.add(code[0]);
    }
  }
  return codes;
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
function extractE2FromErrorCodeSections(content) {
  const codes = new Set();
  const lines = content.split(/\r?\n/);
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+错误码/i.test(line) || /^###\s+错误码/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line) && !/^###/.test(line)) {
      inSection = false;
    }
    if (!inSection) continue;
    if (!line.startsWith('|')) continue;
    const row = line.match(/^\|\s*(E20\d{2})\s*\|/);
    if (row) codes.add(row[1]);
  }

  return codes;
}

/**
 * @param {string} auditRowsDir absolute path
 * @returns {Map<string, Set<string>>} nodeType -> E2xx codes
 */
export function collectNodeE2Codes(auditRowsDir) {
  /** @type {Map<string, Set<string>>} */
  const byNode = new Map();

  let files;
  try {
    files = readdirSync(auditRowsDir).filter((name) => name.endsWith('.md'));
  } catch {
    return byNode;
  }

  for (const file of files) {
    const nodeType = nodeTypeFromAuditFilename(file);
    const content = readFileSync(join(auditRowsDir, file), 'utf8');
    const codes = new Set([
      ...extractErrorCodesColumn(content),
      ...extractE2FromErrorCodeSections(content),
    ]);
    if (codes.size > 0) {
      byNode.set(nodeType, codes);
    }
  }

  return byNode;
}

/**
 * @param {string} content
 * @returns {Map<string, Set<string>>}
 */
export function parseNodeMappingTable(content) {
  /** @type {Map<string, Set<string>>} */
  const mapping = new Map();
  const headingIndex = content.indexOf(NODE_MAPPING_HEADING);
  if (headingIndex < 0) return mapping;

  const section = content.slice(headingIndex);
  const lines = section.split(/\r?\n/);
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('| nodeType |')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    if (/^\|\s*-+\s*\|/.test(line)) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;

    const nodeType = cells[0].replace(/`/g, '');
    const codesCell = cells[1];
    const codes = new Set();
    for (const match of codesCell.matchAll(E2_CODE_RE)) {
      codes.add(match[0]);
    }
    if (nodeType && codes.size > 0) {
      mapping.set(nodeType, codes);
    }
  }

  return mapping;
}

/**
 * @param {{
 *   repoRoot?: string,
 *   errorCodesPath?: string,
 *   auditRowsDir?: string,
 * }} [options]
 */
export function validateErrorCodes(options = {}) {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const errorCodesPath = options.errorCodesPath ?? join(repoRoot, DEFAULT_ERROR_CODES);
  const auditRowsDir = options.auditRowsDir ?? join(repoRoot, DEFAULT_AUDIT_ROWS_DIR);

  /** @type {string[]} */
  const errors = [];

  let errorCodesContent;
  try {
    errorCodesContent = readFileSync(errorCodesPath, 'utf8');
  } catch {
    return {
      ok: false,
      errors: [`missing error codes doc: ${DEFAULT_ERROR_CODES}`],
      undocumentedE2: [],
      nodeMappingGaps: [],
    };
  }

  const documented = extractDocumentedE2Codes(errorCodesContent);
  const nodeE2 = collectNodeE2Codes(auditRowsDir);
  const mapping = parseNodeMappingTable(errorCodesContent);

  /** @type {Set<string>} */
  const usedE2 = new Set();
  for (const codes of nodeE2.values()) {
    for (const code of codes) usedE2.add(code);
  }

  /** @type {string[]} */
  const undocumentedE2 = [...usedE2].filter((code) => !documented.has(code)).sort();
  for (const code of undocumentedE2) {
    errors.push(`E2xx ${code} used in node audit rows but not documented in ${DEFAULT_ERROR_CODES}`);
  }

  if (!errorCodesContent.includes(NODE_MAPPING_HEADING)) {
    errors.push(`missing section: ${NODE_MAPPING_HEADING}`);
  }

  /** @type {string[]} */
  const nodeMappingGaps = [];
  for (const [nodeType, codes] of nodeE2) {
    const mapped = mapping.get(nodeType);
    if (!mapped) {
      nodeMappingGaps.push(nodeType);
      errors.push(`node mapping missing row for \`${nodeType}\` (E2xx: ${[...codes].sort().join(', ')})`);
      continue;
    }
    for (const code of codes) {
      if (!mapped.has(code)) {
        errors.push(
          `node mapping \`${nodeType}\` missing E2xx ${code} (audit row has it, mapping has ${[...mapped].sort().join(', ') || 'none'})`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    undocumentedE2,
    nodeMappingGaps,
    documentedCount: documented.size,
    usedE2Count: usedE2.size,
    nodeCount: nodeE2.size,
  };
}

function main() {
  const result = validateErrorCodes();
  if (result.ok) {
    console.log(
      `OK: ${result.usedE2Count} E2xx codes across ${result.nodeCount} nodes; ${result.documentedCount} documented in ${DEFAULT_ERROR_CODES}`,
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
