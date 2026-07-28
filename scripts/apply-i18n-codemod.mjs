import fs from 'fs';
import path from 'path';
import { catalogUiZhCN } from '../packages/i18n-catalog/src/catalog-ui.ts';

const keyMap = {
  ...JSON.parse(fs.readFileSync('packages/i18n-catalog/src/string-key-map.json', 'utf8')),
};
for (const [key, text] of Object.entries(catalogUiZhCN)) {
  keyMap[text] = key;
}

const root = 'apps/web/src';
const skip = new Set([
  'features/chat/chat-labels.ts',
  'i18n/labels.ts',
  'features/editor/node-type-meta.ts',
  'features/editor/node-param-schemas.ts',
  'features/editor/node-port-defs.ts',
  'features/editor/editor-log-utils.ts',
  'features/editor/editor-agent-stream-format.ts',
  'features/executions/execution-timeline-steps.ts',
]);

function addImports(content, rel) {
  if (content.includes("from '../../i18n/labels.js'") || content.includes("from '../i18n/labels.js'"))
    return content;
  const labelsImport = `import { t } from '${rel.startsWith('layout/') || rel.startsWith('components/') ? '../i18n/labels.js' : '../../i18n/labels.js'}';\n`;

  let hookImport = '';
  if (rel.startsWith('features/settings/')) {
    hookImport =
      "import { useOutletContext } from 'react-router-dom';\nimport type { SettingsOutletContext } from './settings-context.js';\n";
  } else if (rel.startsWith('features/auth/')) {
    return content;
  } else if (rel.endsWith('.tsx')) {
    hookImport =
      "import { useOutletContext } from 'react-router-dom';\nimport type { AppOutletContext } from '../../layout/app-outlet-context.js';\n";
    if (rel.startsWith('layout/')) {
      hookImport =
        "import { useOutletContext } from 'react-router-dom';\nimport type { AppOutletContext } from './app-outlet-context.js';\n";
    }
    if (rel.startsWith('components/')) {
      hookImport = '';
    }
  }

  const firstImport = content.match(/^import .+;\n/m);
  if (!firstImport) return labelsImport + hookImport + content;
  return content.replace(firstImport[0], firstImport[0] + labelsImport + hookImport);
}

function injectLabelsHook(content, rel) {
  if (content.includes('const { labels }') || content.includes('labels }:')) return content;
  if (rel.startsWith('features/auth/')) {
    if (!content.includes('labels: LabelMap') && content.includes('export function')) {
      content = content.replace(
        /import type \{ AuthUser/,
        "import type { LabelMap } from '../../i18n/labels.js';\nimport type { AuthUser",
      );
      content = content.replace(
        /export function (\w+)\(\{([^}]*)\}\)/,
        (m, name, props) => {
          if (props.includes('labels')) return m;
          return `export function ${name}({ labels, ${props}})`;
        },
      );
    }
    return content;
  }
  const fnMatch = content.match(/export function (\w+)\([^)]*\)\s*\{/);
  if (!fnMatch) return content;
  const hook = rel.startsWith('features/settings/')
    ? '  const { labels } = useOutletContext<SettingsOutletContext>();\n'
    : rel.startsWith('components/')
      ? ''
      : '  const { labels } = useOutletContext<AppOutletContext>();\n';
  if (!hook) return content;
  return content.replace(fnMatch[0], fnMatch[0] + hook);
}

function replaceStrings(content) {
  const sorted = Object.keys(keyMap).sort((a, b) => b.length - a.length);
  let out = content;
  for (const text of sorted) {
    const key = keyMap[text];
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const quote of ["'", '"', '`']) {
      const re = new RegExp(`${quote}${escaped}${quote}`, 'g');
      out = out.replace(re, (match, offset) => {
        const slice = out.slice(Math.max(0, offset - 30), offset);
        if (slice.includes('t(labels') || slice.includes('labelKey')) return match;
        if (/label=\{/.test(slice) || /title=\{/.test(slice)) return match;
        return `{t(labels, '${key}')}`;
      });
    }
  }
  return out;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) {
      const rel = p.replace(/\\/g, '/').replace('apps/web/src/', '');
      if (skip.has(rel)) continue;
      let content = fs.readFileSync(p, 'utf8');
      if (!/[\u4e00-\u9fff]/.test(content)) continue;
      const before = content;
      content = replaceStrings(content);
      if (content !== before && /t\(labels/.test(content)) {
        content = addImports(content, rel);
        content = injectLabelsHook(content, rel);
      }
      fs.writeFileSync(p, content);
      if (/[\u4e00-\u9fff]/.test(content)) {
        console.log('remaining:', rel);
      }
    }
  }
}
walk(root);
console.log('done');
