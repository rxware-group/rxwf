#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/workflow/tasks.md';
let content = readFileSync(path, 'utf8');

const doneIds = [];
for (let i = 115; i <= 168; i++) doneIds.push(`T-${i}`);

for (const id of doneIds) {
  content = content.replace(
    new RegExp(`(\\| ${id} \\|[^\\n]+\\| [^|]+ \\| )todo( \\|)`),
    '$1done$2',
  );
}

writeFileSync(path, content);
console.log(`marked ${doneIds.length} tasks done`);
