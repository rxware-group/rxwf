import fs from 'fs';
import path from 'path';

const root = 'apps/web/src';

function fix(content) {
  let out = content.replace(
    /\{\s*\n\s*const labels = useLabels\(\);\s*\n/g,
    '{\n',
  );
  if (!out.includes('const labels = useLabels()')) {
    out = out.replace(
      /(export function \w+\([^)]*\)\s*\{)/,
      '$1\n  const labels = useLabels();\n',
    );
  }
  return out;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) {
      const c = fs.readFileSync(p, 'utf8');
      if (c.includes('useLabels')) {
        fs.writeFileSync(p, fix(c));
      }
    }
  }
}
walk(root);
console.log('done');
