import fs from 'fs';
import path from 'path';

const root = 'apps/web/src';
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(e.name) && !e.name.includes('.test.')) files.push(p);
  }
}
walk(root);

const re = /'([^'\\\n]*[\u4e00-\u9fff][^'\\\n]*)'|"([^"\\\n]*[\u4e00-\u9fff][^"\\\n]*)"|`([^`\\\n]*[\u4e00-\u9fff][^`\\\n]*)`/gu;
const set = new Set();
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(t))) {
    const s = m[1] ?? m[2] ?? m[3];
    if (s.length < 100 && !s.includes('${')) set.add(s);
  }
}
const out = [...set].sort();
fs.writeFileSync('scripts/zh-strings.txt', out.join('\n'));
console.log('wrote', out.length, 'strings');
