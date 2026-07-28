import fs from 'fs';
import path from 'path';

const root = 'apps/web/src';

function fix(content) {
  let out = content;
  out = out.replace(/\? \{t\(labels/g, '? t(labels');
  out = out.replace(/: \{t\(labels/g, ': t(labels');
  out = out.replace(/\( \{t\(labels/g, '(t(labels');
  out = out.replace(/, \{t\(labels/g, ', t(labels');
  out = out.replace(/= \{t\(labels/g, '= t(labels');
  out = out.replace(/: \{t\(labels/g, ': t(labels');
  out = out.replace(/\|\| \{t\(labels/g, '|| t(labels');
  out = out.replace(/&& \{t\(labels/g, '&& t(labels');
  // dedupe imports
  const lines = out.split('\n');
  const seen = new Set();
  const deduped = [];
  for (const line of lines) {
    if (line.startsWith('import ')) {
      if (seen.has(line)) continue;
      seen.add(line);
    }
    deduped.push(line);
  }
  out = deduped.join('\n');
  // fix THEMES.map shadowing t
  out = out.replace(
    /THEMES\.map\(\(t\) =>/g,
    'THEMES.map((themeId) =>',
  );
  out = out.replace(
    /THEMES\.map\(\(t, /g,
    'THEMES.map((themeId, ',
  );
  return out;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) {
      const c = fs.readFileSync(p, 'utf8');
      const f = fix(c);
      if (f !== c) fs.writeFileSync(p, f);
    }
  }
}
walk(root);
console.log('fixed');
