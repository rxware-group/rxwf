#!/usr/bin/env node
/**
 * Validates node help markdown against OQ-007 / OQ-011 (FR-07).
 *
 * Usage:
 *   node scripts/validate-help-doc.mjs docs/help/zh/nodes/manualTrigger.md
 *   node scripts/validate-help-doc.test.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_CHAR_COUNT = 300;
export const MIN_CJK_CHARS = MIN_CHAR_COUNT;

/** @type {{ id: string; pattern: RegExp }[]} */
export const REQUIRED_SECTIONS = [
  { id: '用途', pattern: /^##\s*用途\s*$/m },
  { id: '端口', pattern: /^##\s*(端口(?:与连接|\/连接)?|连接|出口)\s*$/m },
  { id: '参数', pattern: /^##\s*参数\s*$/m },
  { id: '常见错误', pattern: /^##\s*(常见错误|相关错误码)\s*$/m },
  { id: '示例', pattern: /^##\s*示例\s*$/m },
];

/** @type {{ id: string; pattern: RegExp }[]} */
export const REQUIRED_EXAMPLES = [
  { id: '示例 A', pattern: /^###\s*示例\s*A\s*$/m },
  { id: '示例 B', pattern: /^###\s*示例\s*B\s*$/m },
  { id: '示例 C', pattern: /^###\s*示例\s*C\s*$/m },
];

/**
 * Count Han + letters + digits outside fenced code blocks.
 * @param {string} text
 */
export function countContentChars(text) {
  const withoutFrontmatter = text.replace(/^---[\s\S]*?---\n?/, '');
  const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
  const chars = withoutCode.match(/[\p{Script=Han}a-zA-Z0-9]/gu);
  return chars ? chars.length : 0;
}

/** @deprecated alias */
export const countCjkChars = countContentChars;

/**
 * @param {string} content
 * @returns {{ ok: boolean; errors: string[]; charCount: number; cjkChars: number }}
 */
export function validateHelpDocContent(content) {
  /** @type {string[]} */
  const errors = [];
  const charCount = countContentChars(content);

  if (charCount < MIN_CHAR_COUNT) {
    errors.push(`正文字符数 ${charCount} < ${MIN_CHAR_COUNT}`);
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!section.pattern.test(content)) {
      errors.push(`缺少必需章节: ${section.id}`);
    }
  }

  const missingExamples = REQUIRED_EXAMPLES.filter((ex) => !ex.pattern.test(content));
  if (missingExamples.length > 0) {
    errors.push(`缺少必需章节: 示例 A/B/C（缺 ${missingExamples.map((e) => e.id).join('、')}）`);
  }

  return { ok: errors.length === 0, errors, charCount, cjkChars: charCount };
}

/**
 * @param {string} filePath
 */
export function validateHelpDocFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return validateHelpDocContent(content);
  } catch (err) {
    return {
      ok: false,
      errors: [`无法读取文件: ${filePath} (${err instanceof Error ? err.message : String(err)})`],
      charCount: 0,
      cjkChars: 0,
    };
  }
}

/**
 * Accept markdown content (contains newline) or filesystem path.
 * @param {string} input
 */
export function validateHelpDoc(input) {
  if (input.includes('\n')) {
    return validateHelpDocContent(input);
  }
  return validateHelpDocFile(resolve(input));
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/validate-help-doc.mjs <path-to-help.md>');
    process.exit(2);
  }

  const result = validateHelpDocFile(resolve(filePath));
  if (result.ok) {
    console.log(`OK ${filePath} (${result.charCount} chars)`);
    process.exit(0);
  }

  console.error(`FAIL ${filePath}`);
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main();
}
