import fs from 'fs';
import path from 'path';
import { catalogUiZhCN } from '../packages/i18n-catalog/src/catalog-ui.ts';

const keyMap = {
  ...JSON.parse(fs.readFileSync('packages/i18n-catalog/src/string-key-map.json', 'utf8')),
};
for (const [k, v] of Object.entries(catalogUiZhCN)) keyMap[v] = k;

const root = 'apps/web/src';
const skip = new Set([
  'features/chat/chat-labels.ts',
  'i18n/labels.tsx',
  'features/editor/node-type-meta.ts',
  'features/editor/node-param-schemas.ts',
  'features/editor/node-port-defs.ts',
]);

function keyFor(text) {
  return keyMap[text] ?? null;
}

function ensureImports(content) {
  if (content.includes('useLabels')) return content;
  const imp = "import { t, useLabels } from '../../i18n/labels.tsx';\n";
  const impLayout = "import { t, useLabels } from '../i18n/labels.tsx';\n";
  const impComponents = "import { t, useLabels } from '../i18n/labels.tsx';\n";
  const use = rel.startsWith('layout/')
    ? impLayout
    : rel.startsWith('components/')
      ? impComponents
      : imp;
  const m = content.match(/^import .+;\n/m);
  if (!m) return use + content;
  return content.replace(m[0], m[0] + use);
}

function ensureHook(content) {
  if (content.includes('const labels = useLabels()')) return content;
  const fn = content.match(/export function \w+[^{]*\{/);
  if (!fn) return content;
  return content.replace(fn[0], fn[0] + '\n  const labels = useLabels();\n');
}

let rel = '';

function transform(content) {
  let out = content;
  const texts = Object.keys(keyMap).sort((a, b) => b.length - a.length);
  for (const text of texts) {
    const key = keyMap[text];
    const esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // JSX attribute: label="text" or label='text'
    out = out.replace(
      new RegExp(`(\\w+)=["']${esc}["']`, 'g'),
      `$1={t(labels, '${key}')}`,
    );

    // JSX children: >text<
    out = out.replace(
      new RegExp(`>${esc}<`, 'g'),
      `>{t(labels, '${key}')}<`,
    );

    // Call argument or assignment: ('text') or ('text', or = 'text'
    out = out.replace(
      new RegExp(`(\\(|,\\s*|\\?\\s*|:\\s*|=\\s*)['"]${esc}['"]`, 'g'),
      `$1t(labels, '${key}')`,
    );
  }
  return out;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) {
      rel = p.replace(/\\/g, '/').replace('apps/web/src/', '');
      if (skip.has(rel)) continue;
      let c = fs.readFileSync(p, 'utf8');
      if (!/[\u4e00-\u9fff]/.test(c)) continue;
      const orig = c;
      c = transform(c);
      if (c !== orig) {
        c = ensureImports(c);
        c = ensureHook(c);
        fs.writeFileSync(p, c);
      }
      if (/[\u4e00-\u9fff]/.test(c)) console.log('zh left:', rel);
    }
  }
}
walk(root);
