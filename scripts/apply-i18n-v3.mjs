import fs from 'fs';
import path from 'path';
import { catalogUiZhCN } from '../packages/i18n-catalog/src/catalog-ui.ts';

const keyMap = {
  ...JSON.parse(fs.readFileSync('packages/i18n-catalog/src/string-key-map.json', 'utf8')),
};
for (const [k, v] of Object.entries(catalogUiZhCN)) keyMap[v] = k;

const TEMPLATE_MAP = {
  '将永久删除「{name}」及其版本历史，此操作不可撤销。': 'auto.t_delete_workflow_confirm',
  '确定将「{email}」设为 Admin？': 'auto.t_set_admin_confirm',
  '确定撤销「{email}」的 Admin 权限？至少需保留一名 Admin。': 'auto.t_revoke_admin_confirm',
  '将为「{email}」生成临时密码，并吊销其现有会话。': 'auto.t_reset_password_confirm',
  '已向 {email} 重新发送邀请邮件': 'auto.t_resent_invite',
  '确定撤销对「{email}」的邀请？该用户将从列表中移除。': 'auto.t_revoke_invite_confirm',
  '确定停用「{email}」？其现有会话将立即失效。': 'auto.t_disable_user_confirm',
  '将永久删除已停用的用户「{email}」。此操作不可恢复。': 'auto.t_delete_user_confirm',
  '邮箱：{email}\n密码：{password}': 'auto.t_credentials_copy',
  '确定吊销「{label}」？使用该 Token 的 IDE 将无法再连接。': 'auto.t_revoke_mcp_token',
  '将永久删除凭证「{name}」': 'auto.t_delete_credential',
  '删除环境变量「{key}」？': 'auto.t_delete_env_var',
  '已更新主题 {themeId}': 'auto.t_theme_updated',
  '已更新 {locale} 文案覆盖': 'auto.t_i18n_updated',
  '节点 {name} 执行失败': 'auto.t_node_exec_failed',
  '{name} 副本': 'auto.t_name_copy',
  '节点名称「{name}」重复': 'auto.t_duplicate_node_name',
  '已选 {count} 个工具': 'auto.t_tools_selected',
  '{n} 项': 'auto.t_n_items',
  'v{a} ({saLen} 字符) ↔ v{b} ({sbLen} 字符)\n\n{preview}': 'auto.t_version_diff',
  '将基于 v{version} 创建新版本（当前 v{currentVersion} 不会被删除）。运行中的执行仍使用当时快照。确定回滚？':
    'auto.t_rollback_confirm',
  '已连接 {baseUrl}。工作流中的 Ollama 节点将使用该地址。': 'auto.t_ollama_connected',
};

const root = 'apps/web/src';
const skip = new Set([
  'features/chat/chat-labels.ts',
  'features/editor/node-type-meta.ts',
  'features/editor/node-param-schemas.ts',
  'features/editor/node-port-defs.ts',
]);

function depthToImport(rel) {
  const depth = rel.split('/').length - 1;
  const prefix = '../'.repeat(depth);
  return `import { t, useLabels } from '${prefix}i18n/labels.js';\n`;
}

function ensureImports(content, rel) {
  if (content.includes('useLabels')) return content;
  const imp = depthToImport(rel);
  const m = content.match(/^import .+;\n/m);
  if (!m) return imp + content;
  return content.replace(m[0], m[0] + imp);
}

function ensureHook(content) {
  if (content.includes('const labels = useLabels()')) return content;
  const fn = content.match(/export function \w+[^{]*\{/);
  if (!fn) return content;
  return content.replace(fn[0], fn[0] + '\n  const labels = useLabels();\n');
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function transform(content) {
  let out = content;
  const texts = Object.keys(keyMap).sort((a, b) => b.length - a.length);

  for (const text of texts) {
    const key = keyMap[text];
    const esc = escRe(text);

    // JSX attribute: label="text"
    out = out.replace(new RegExp(`(\\w+)=["']${esc}["']`, 'g'), `$1={t(labels, '${key}')}`);

    // JSX children with optional whitespace
    out = out.replace(new RegExp(`>\\s*${esc}\\s*<`, 'g'), `>{t(labels, '${key}')}<`);

    // String in parens/comma/assignment (not in comments)
    out = out.replace(
      new RegExp(`(\\(|,\\s*|\\?\\s*|:\\s*|=\\s*)['"]${esc}['"]`, 'g'),
      `$1t(labels, '${key}')`,
    );

    // return 'text';
    out = out.replace(new RegExp(`return\\s+['"]${esc}['"]`, 'g'), `return t(labels, '${key}')`);
  }

  // Template literals with known patterns
  for (const [pattern, key] of Object.entries(TEMPLATE_MAP)) {
    const vars = [...pattern.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    let reStr = escRe(pattern);
    for (const v of vars) {
      reStr = reStr.replace(`\\{${v}\\}`, '\\$\\{' + v + '\\}');
    }
    const re = new RegExp('`' + reStr + '`', 'g');
    if (vars.length === 0) continue;
    const args = vars.map((v) => `${v}: ${v}`).join(', ');
    const tArgs = vars.map((v) => `${v}: String(${v})`).join(', ');
    out = out.replace(re, (_m, ...groups) => {
      const varObj = vars.map((v, i) => `${v}: String(${groups[i]})`).join(', ');
      return `t(labels, '${key}', { ${varObj} })`;
    });
  }

  // Mixed JSX: 状态:{' '}
  out = out.replace(/>\s*状态:\{' '\}\s*</g, ">{t(labels, 'auto.t_62e951a6')}:{' '}<");

  return out;
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) {
      const rel = p.replace(/\\/g, '/').replace('apps/web/src/', '');
      if (skip.has(rel)) continue;
      let c = fs.readFileSync(p, 'utf8');
      if (!/[\u4e00-\u9fff]/.test(c)) continue;
      const orig = c;
      c = transform(c);
      if (c !== orig) {
        c = ensureImports(c, rel);
        c = ensureHook(c);
        fs.writeFileSync(p, c);
      }
      if (/[\u4e00-\u9fff]/.test(c)) console.log('zh left:', rel);
    }
  }
}

walk(root);
