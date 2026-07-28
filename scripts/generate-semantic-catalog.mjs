import fs from 'fs';
import crypto from 'crypto';

const zhList = fs
  .readFileSync('scripts/zh-strings.txt', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean);

const zh = {};
const en = {};
const keyByText = {};

for (const text of zhList) {
  const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
  const part = text
    .replace(/[^\w]+/g, '_')
    .slice(0, 24)
    .replace(/^_|_$/g, '') || 't';
  const key = `auto.${part}_${hash}`;
  keyByText[text] = key;
  zh[key] = text;
  en[key] = /^[\x00-\x7F\s.,!?;:()\-–—…'"]+$/.test(text) ? text : text;
}

const lines = (obj) =>
  Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`)
    .join('\n');

fs.writeFileSync(
  'packages/i18n-catalog/src/app-strings.ts',
  `/** Auto-generated from scripts/zh-strings.txt */
export const appStringsZhCN: Record<string, string> = {
${lines(zh)}
};

export const appStringsEn: Record<string, string> = {
${lines(en)}
};
`,
);

fs.writeFileSync(
  'packages/i18n-catalog/src/string-key-map.json',
  JSON.stringify(keyByText, null, 2),
);

console.log('keys', Object.keys(zh).length);
