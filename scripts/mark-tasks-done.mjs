#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/workflow/tasks.md';
let content = readFileSync(path, 'utf8');

const doneIds = [];
for (let i = 115; i <= 159; i++) doneIds.push(`T-${i}`);
doneIds.push('T-160', 'T-161', 'T-162');

for (const id of doneIds) {
  content = content.replace(
    new RegExp(`(\\| ${id} \\|[^\\n]+\\| [^|]+ \\| )todo( \\|)`),
    '$1done$2',
  );
}

writeFileSync(path, content);
console.log(`marked ${doneIds.length} tasks done`);
