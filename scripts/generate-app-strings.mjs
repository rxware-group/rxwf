import fs from 'fs';
import crypto from 'crypto';

const zhList = fs.readFileSync('scripts/zh-strings.txt', 'utf8').trim().split('\n');

/** Rough EN translations for common UI fragments */
const phraseEn = new Map([
  ['加载中…', 'Loading…'],
  ['正在加载…', 'Loading…'],
  ['正在加载配置…', 'Loading configuration…'],
  ['保存', 'Save'],
  ['取消', 'Cancel'],
  ['删除', 'Delete'],
  ['确认', 'Confirm'],
  ['登录', 'Sign in'],
  ['登录中…', 'Signing in…'],
  ['邮箱', 'Email'],
  ['密码', 'Password'],
  ['设置', 'Settings'],
  ['工作流', 'Workflows'],
  ['执行', 'Executions'],
  ['用户', 'Users'],
  ['刷新', 'Refresh'],
  ['刷新中…', 'Refreshing…'],
  ['创建', 'Create'],
  ['添加', 'Add'],
  ['编辑', 'Edit'],
  ['关闭', 'Close'],
  ['启用', 'Enable'],
  ['停用', 'Disable'],
  ['已保存', 'Saved'],
  ['操作失败', 'Operation failed'],
  ['加载失败', 'Failed to load'],
]);

function slug(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

function toEn(zh) {
  if (phraseEn.has(zh)) return phraseEn.get(zh);
  if (/^[\x00-\x7F\s]+$/.test(zh)) return zh;
  return zh; // fallback: keep zh until manually fixed — tests will catch missing en quality
}

const zh = {};
const en = {};

for (const text of zhList) {
  const key = `str.${slug(text)}`;
  zh[key] = text;
  en[key] = toEn(text);
}

const lines = (obj) =>
  Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `    '${k}': ${JSON.stringify(v)},`)
    .join('\n');

const out = `/** Auto-generated from scripts/zh-strings.txt — semantic keys preferred for new strings */
export const appStringsZhCN: Record<string, string> = {
${lines(zh)}
};

export const appStringsEn: Record<string, string> = {
${lines(en)}
};
`;

fs.writeFileSync('packages/i18n-catalog/src/app-strings.generated.ts', out);
console.log('keys', Object.keys(zh).length);
