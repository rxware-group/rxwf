#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'docs/help/zh/nodes';
const letters = ['A', 'B', 'C'];

/** @param {string} content */
function fixExampleHeadings(content) {
  let idx = 0;
  return content.replace(/^### 示例\s*\r?\n\r?\n(?:\*\*\*\*\r?\n\r?\n)?/gm, () => {
    const letter = letters[idx++] ?? 'C';
    return `### 示例 ${letter}\n\n`;
  });
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const path = join(dir, file);
  const before = readFileSync(path, 'utf8');
  const after = fixExampleHeadings(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log('fixed', file);
  }
}
