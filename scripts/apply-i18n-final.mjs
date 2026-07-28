import fs from 'fs';
import path from 'path';
import { catalogUiZhCN } from '../packages/i18n-catalog/src/catalog-ui.ts';
import { appStringsZhCN } from '../packages/i18n-catalog/src/app-strings.ts';

const keyMap = {
  ...JSON.parse(fs.readFileSync('packages/i18n-catalog/src/string-key-map.json', 'utf8')),
};
for (const [k, v] of Object.entries(catalogUiZhCN)) keyMap[v] = k;
for (const [k, v] of Object.entries(appStringsZhCN)) keyMap[v] = k;

// Extra template patterns: zh pattern -> { key, vars: ['name', ...] }
const TEMPLATES = [
  {
    re: /^将永久删除「(.+)」及其版本历史，此操作不可撤销。$/,
    key: 'confirm.deleteWorkflow',
    vars: ['name'],
  },
  {
    re: /^确定将「(.+)」设为 Admin？$/,
    key: 'confirm.setAdmin',
    vars: ['email'],
  },
  {
    re: /^确定撤销「(.+)」的 Admin 权限？至少需保留一名 Admin。$/,
    key: 'confirm.revokeAdmin',
    vars: ['email'],
  },
  {
    re: /^将为「(.+)」生成临时密码，并吊销其现有会话。$/,
    key: 'confirm.resetPassword',
    vars: ['email'],
  },
  {
    re: /^已向 (.+) 重新发送邀请邮件$/,
    key: 'toast.resentInvite',
    vars: ['email'],
  },
  {
    re: /^确定撤销对「(.+)」的邀请？该用户将从列表中移除。$/,
    key: 'confirm.revokeInvite',
    vars: ['email'],
  },
  {
    re: /^确定停用「(.+)」？其现有会话将立即失效。$/,
    key: 'confirm.disableUser',
    vars: ['email'],
  },
  {
    re: /^将永久删除已停用的用户「(.+)」。此操作不可恢复。$/,
    key: 'confirm.deleteUser',
    vars: ['email'],
  },
  {
    re: /^确定吊销「(.+)」？使用该 Token 的 IDE 将无法再连接。$/,
    key: 'confirm.revokeMcpToken',
    vars: ['label'],
  },
  {
    re: /^将永久删除凭证「(.+)」$/,
    key: 'confirm.deleteCredential',
    vars: ['name'],
  },
  {
    re: /^删除环境变量「(.+)」？$/,
    key: 'confirm.deleteEnvVar',
    vars: ['key'],
  },
  {
    re: /^已更新主题 (.+)$/,
    key: 'toast.themeUpdated',
    vars: ['themeId'],
  },
  {
    re: /^已更新 (.+) 文案覆盖$/,
    key: 'toast.i18nUpdated',
    vars: ['locale'],
  },
  {
    re: /^节点 (.+) 执行失败$/,
    key: 'toast.nodeExecFailed',
    vars: ['name'],
  },
  {
    re: /^(.+) 副本$/,
    key: 'workflow.nameCopy',
    vars: ['name'],
  },
  {
    re: /^节点名称「(.+)」重复$/,
    key: 'editor.duplicateNodeName',
    vars: ['name'],
  },
  {
    re: /^已选 (\d+) 个工具$/,
    key: 'mcp.toolsSelected',
    vars: ['count'],
  },
  {
    re: /^(\d+) 项$/,
    key: 'common.nItems',
    vars: ['n'],
  },
];

const EXTRA_STRINGS = {
  '参数': 'editor.params',
  '此节点类型暂无可编辑参数。': 'editor.noEditableParams',
  '← 执行列表': 'executions.backToList',
  '执行监控': 'executions.monitor',
  ' · 自动刷新中': 'executions.autoRefreshing',
  '导入到编辑器调试': 'executions.importToEditor',
  '时间线': 'executions.timeline',
  '失败节点 ({count})': 'executions.failedNodes',
  '历史（最多 50 条）': 'executions.historyMax50',
  '模板画廊': 'templates.gallery',
  '新建': 'common.createNew',
  '我的工作流': 'workflows.mine',
  '全部工作流': 'workflows.all',
  '全部': 'common.all',
  '我创建的': 'workflows.createdByMe',
  '与我共享的': 'workflows.sharedWithMe',
  '从模板创建': 'workflows.createFromTemplate',
  '空白创建': 'workflows.createBlank',
  '查看': 'common.view',
  '← 工作流': 'workflows.back',
  '从内置模板快速创建工作流草稿。': 'templates.lead',
  '加载安装清单…': 'setup.loadingChecklist',
  '配置公网地址：设置环境变量 ': 'setup.publicUrlLead',
  ' 后重启 API。': 'setup.publicUrlTail',
  '浏览模板画廊': 'setup.browseTemplates',
  '返回工作流': 'setup.backToWorkflows',
  '活跃': 'users.status.active',
  '已停用': 'users.status.disabled',
  '待接受邀请': 'users.status.pending',
  '邀请': 'users.joinMethod.invite',
  '直接创建': 'users.joinMethod.direct',
  '将向该邮箱发送接受邀请链接（7 天内有效）。': 'users.inviteHint',
  '生成随机密码': 'users.generatePassword',
  '邮箱：': 'users.emailLabel',
  '密码：': 'users.passwordLabel',
  '管理团队成员、邀请与权限。': 'users.lead',
  '邀请用户': 'users.inviteUser',
  '复制账号信息': 'users.copyCredentials',
  '系统角色': 'users.col.systemRole',
  '加入方式': 'users.col.joinMethod',
  '最后登录': 'users.col.lastLogin',
  '暂无用户。': 'users.empty',
  '当前用户': 'users.currentUser',
  '可通过邀请或直接创建添加团队成员。': 'users.emptyHint',
  ' 中设置 SMTP。': 'users.smtpHintTail',
  '邀请功能需先在 ': 'users.smtpHintLead',
  '正在加载系统配置…': 'settings.system.loading',
  '站点、邮件与集成参数保存后由服务端运行时读取。': 'settings.system.lead',
  '站点': 'settings.system.site',
  '邮件': 'settings.system.mail',
  '请填写对外 URL 与完整 SMTP（主机、端口、发件人）后，方可启用找回密码与测试邮件。':
    'settings.system.smtpHint',
  '启用 TLS': 'settings.system.enableTls',
  '集成': 'settings.system.integrations',
  '当前登录账号与角色。': 'settings.profile.lead',
  '当前账号': 'settings.profile.account',
  '安全': 'settings.profile.security',
  '修改密码': 'settings.profile.changePassword',
  '了解角色权限 →': 'settings.profile.rolesLink',
  '退出登录': 'settings.profile.logout',
  '设置': 'settings.title',
  '工作流平台版本与部署信息。左侧导航可进入各配置项。': 'settings.index.lead',
  '部署档位': 'settings.index.deployProfile',
  'HTTP 端口': 'settings.index.httpPort',
  'Plus 能力': 'settings.index.plusFeatures',
  '公网 URL': 'settings.index.publicUrl',
  '以下为平台固定角色。': 'settings.roles.lead1',
  ' 在「用户管理」中分配；': 'settings.roles.lead2',
  ' 在「工作流 → 协作」中按工作流分配。': 'settings.roles.lead3',
  '权限': 'settings.roles.col.permission',
  '保存并重试': 'settings.models.saveRetry',
  '安装 Ollama': 'settings.models.installOllama',
  'Chat 与模型目录请前往 ': 'settings.models.chatLead',
  '。': 'common.period',
  '模型服务（Ollama）': 'settings.models.ollamaService',
  '正在加载配置…': 'settings.models.loadingConfig',
  '正在检测连接…': 'settings.models.checkingConnection',
  '已连接 {baseUrl}。工作流中的 Ollama 节点将使用该地址。': 'settings.models.connected',
  'Plus 工作流使用 ': 'settings.models.plusHintLead',
  ' 节点时，请保持服务运行。': 'settings.models.plusHintTail',
  '管理 Chat 与 AI 节点可用的模型提供商与模型目录。': 'settings.catalog.lead',
  '工作流 Ollama 默认地址': 'settings.catalog.ollamaDefault',
  '添加提供商': 'settings.catalog.addProvider',
  'OpenAI 兼容': 'settings.catalog.openaiCompatible',
  '添加': 'common.add',
  '已禁用': 'common.disabled',
  '健康：': 'settings.catalog.health',
  '上次检测：': 'settings.catalog.lastHealth',
  '暂无模型': 'settings.catalog.noModels',
  '默认 Chat': 'settings.catalog.defaultChat',
  '为 AI IDE 签发专用 Token，用于连接 ': 'settings.mcpTokens.lead',
  '创建 Token': 'settings.mcpTokens.create',
  'Token（仅显示一次）：': 'settings.mcpTokens.tokenOnce',
  'mcp.json 片段：': 'settings.mcpTokens.mcpJsonSnippet',
  '复制 mcp.json': 'settings.mcpTokens.copyMcpJson',
  '已签发': 'settings.mcpTokens.issued',
  '暂无 Token': 'settings.mcpTokens.empty',
  '吊销': 'settings.mcpTokens.revoke',
  'LangSmith 追踪': 'settings.langsmith.title',
  '启用后，LangChain Agent 调用会写入 LangSmith 项目。执行时间线仍以本系统': 'settings.langsmith.lead1',
  ' 为准。': 'settings.langsmith.lead2',
  '当前已启用（LANGCHAIN_TRACING_V2 + API Key）。': 'settings.langsmith.enabled',
  '也可在进程环境变量中设置 ': 'settings.langsmith.envHint1',
  '；保存后数据库配置优先并立即作用于 API': 'settings.langsmith.envHint2',
  '进程。': 'settings.langsmith.envHint3',
  '测试': 'common.test',
  '主题 Token（Admin）': 'settings.adminTheme.title',
  '国际化覆盖（Admin）': 'settings.adminI18n.title',
  '上传 common 片段 JSON，合并到运行时 i18n catalog。': 'settings.adminI18n.lead',
  'Runner 策略': 'runners.policy.title',
  '— 选择 —': 'common.selectPlaceholder',
  ' (内置)': 'runners.builtinSuffix',
  '无匹配时': 'runners.noMatch',
  '● 在线': 'runners.status.online',
  '◐ 排水': 'runners.status.draining',
  '○ 离线': 'runners.status.offline',
  '平台': 'runners.col.platform',
  '负载': 'runners.col.load',
  '暂无 Runner。请确认 API 已启动且 bootstrap 已注册 Embedded Runner。': 'runners.empty',
  'v1.0-core 为只读列表。工作流级 ': 'runners.readonlyLead1',
  ' 请在': 'runners.readonlyLead2',
  ' 中配置（ux §3.23.2）。': 'runners.readonlyLead3',
  '内置 Embedded Runner 由控制面本机 OS 自动探测注册。': 'runners.embeddedHint',
  '上传已签名的插件 manifest（.tgz 流程在服务端简化为 manifest + HMAC 签名）。':
    'plugins.lead',
  '注册插件': 'plugins.register',
  '注册': 'common.register',
  '已安装': 'plugins.installed',
  '上传插件': 'plugins.upload',
  '查看文档': 'plugins.viewDocs',
  '注册 stdio（npx / docker）或 HTTP 传输的 MCP 服务。Docker 可留空镜像，直接运行':
    'mcp.lead1',
  '（与 Cursor ': 'mcp.lead2',
  ' 一致）；填写镜像时使用': 'mcp.lead3',
  '新增': 'common.addNew',
  '默认': 'common.default',
  '已注册': 'common.registered',
  '暂无 MCP 服务器': 'mcp.empty',
  '测试连接': 'mcp.testConnection',
  '上传文档、异步索引，并可在 Chat 中开启 RAG 问答。': 'knowledge.list.lead',
  '新建知识库': 'knowledge.list.create',
  '阈值 ': 'knowledge.threshold',
  '← 知识库列表': 'knowledge.backToList',
  '混合检索（向量 + BM25 / RRF）': 'knowledge.hybridSearch',
  '重新索引': 'knowledge.reindex',
  '将服务器本地目录中的 TXT/MD/PDF 同步入库（路径为 API 进程可见的绝对路径）。':
    'knowledge.syncLead',
  '例如 D:\\docs\\kb': 'knowledge.syncPlaceholder',
  '添加同步源': 'knowledge.addSyncSource',
  '立即同步': 'knowledge.syncNow',
  '检索': 'knowledge.search',
  '执行历史': 'executions.history',
  '共 {total} 条': 'executions.totalCount',
  '清除筛选': 'common.clearFilter',
  '打开工作流': 'executions.openWorkflow',
  '开始': 'executions.col.start',
  '耗时': 'executions.col.duration',
  '详情': 'common.details',
  '上一页': 'common.prevPage',
  '下一页': 'common.nextPage',
  '键': 'env.col.key',
  '值': 'env.col.value',
  '环境': 'env.col.environment',
  '新增 / 更新': 'env.addOrUpdate',
  '全局环境变量。编辑与调试使用 test；发布后的生产触发使用 prod。同一键可勾选多个环境并共用同一值。':
    'env.lead',
  '执行中…': 'common.running',
  '失败': 'common.failed',
  '空便签': 'editor.emptyStickyNote',
  '复制节点': 'editor.copyNode',
  '删除节点': 'editor.deleteNode',
  '已禁用': 'editor.disabled',
  '协作': 'editor.collaborators',
  '正在加载工作流…': 'editor.loadingWorkflow',
  '管理可访问此工作流的用户与角色。': 'editor.collaboratorsLead',
  '查看角色说明': 'editor.viewRoles',
  '添加协作者': 'editor.addCollaborator',
  '正在加载协作者…': 'editor.loadingCollaborators',
  '用户': 'common.user',
  '角色': 'common.role',
  '移除': 'common.remove',
  '暂无协作者': 'editor.noCollaborators',
  '从左侧节点面板点击添加节点，或拖动画布后使用右下角控件缩放': 'editor.canvasHint',
  '（未设置）': 'webhook.notSet',
  '轮换': 'webhook.rotate',
  '未配置 Secret 时 Webhook 将返回 E2005。': 'webhook.noSecretHint',
  '测试 URL': 'webhook.testUrl',
  '（编辑模式，读最新已保存草稿）': 'webhook.testUrlHint',
  '生产 URL': 'webhook.prodUrl',
  '（发布后可用，读已发布版本）': 'webhook.prodUrlHint',
  '版本历史': 'editor.versionHistory',
  '对比': 'editor.compare',
  '回滚': 'editor.rollback',
  '（当前 ID 未在列表中）': 'editor.toolWorkflowNotInList',
  '仅显示已发布且开启「作为 Agent Tool 暴露」的工作流。': 'editor.toolWorkflowHint',
  '选择要推送到生产环境的已保存版本。': 'editor.publishHint',
  '固定': 'editor.mode.fixed',
  '表达式': 'editor.mode.expression',
  '搜索节点': 'editor.searchNodes',
  'Plus 节点未启用（后端未加载 plus 模块）': 'editor.plusNodesDisabled',
  '尚未执行。': 'editor.notExecutedYet',
  '执行成功，无输出项。': 'editor.successNoOutput',
  '未命名': 'editor.unnamed',
  '前序节点输出；拖拽字段到参数生成表达式。': 'editor.inputPaneHint',
  '无上游节点。': 'editor.noUpstreamNodes',
  '请先选择 MCP Server': 'editor.mcp.selectServerFirst',
  '加载工具…': 'editor.mcp.loadingTools',
  '选择工具…': 'editor.mcp.selectTools',
  '选择服务器…': 'editor.mcp.selectServer',
  '正在从 MCP Server 加载工具…': 'editor.mcp.loadingFromServer',
  '无可用工具': 'editor.mcp.noTools',
  '无输出项': 'editor.noOutputItems',
  '允许其他工作流的 AI Agent 通过 Workflow Tool 调用（需发布后生效）':
    'editor.exposeAsToolHint',
  '未保存': 'editor.unsaved',
  '撤销': 'editor.undo',
  '重做': 'editor.redo',
  '调试': 'editor.debug',
  '发布': 'editor.publish',
  '发布更新': 'editor.publishUpdate',
  '取消发布': 'editor.unpublish',
  '日志': 'editor.log',
  '清理执行数据': 'editor.clearExecutionData',
  '输入': 'editor.input',
  '输出': 'editor.output',
  '执行中': 'editor.running',
  '成功': 'editor.success',
  '尚无已执行节点。': 'editor.noExecutedNodes',
  '执行节点后在此查看输入、输出与运行日志。': 'editor.logHintExecute',
  '选择节点以查看输入与输出。': 'editor.logHintSelect',
  '无输入数据。先执行上游节点。': 'editor.noInputData',
  '尚未执行或无输出。': 'editor.noOutputYet',
  '无运行日志。': 'editor.noRunLog',
  '无 Agent/Crew 流事件。执行后显示工具调用与 Crew 委派步骤。': 'editor.noAgentStream',
  '单 Agent': 'agents.singleAgent',
  'Crew 顺序': 'agents.crewSequential',
  'Crew 层级': 'agents.crewHierarchical',
  '独立 Agent 画布（范式 B）：专用列表与节点面板，执行引擎与工作流相同。': 'agents.lead',
  '新建 Agent': 'agents.createNew',
  '关闭': 'common.close',
  'Supervisor 时间线': 'auto.Supervisor_058bdf05',
  '层级 Crew 时间线': 'auto.Crew_a360d865',
  '顺序 Crew 时间线': 'auto.Crew_b19d71c9',
  'Agent 步骤': 'auto.Agent_f7a3cf2e',
  '执行步骤': 'auto.t_6424a779',
  '未知决策': 'auto.t_0046f531',
  '完成': 'auto.t_33246f6a',
  '决策': 'auto.t_462f8a61',
  '协调者': 'auto.t_eefdd05b',
  '最终输出': 'auto.t_94d4f8c0',
};

for (const [zh, key] of Object.entries(EXTRA_STRINGS)) {
  keyMap[zh] = key;
}

function depthToImport(rel) {
  const depth = rel.split('/').length - 1;
  return `import { t, useLabels } from '${ '../'.repeat(depth) }i18n/labels.js';\n`;
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

function keyFor(text) {
  return keyMap[text] ?? null;
}

function transformTemplateLiteral(lit) {
  for (const tpl of TEMPLATES) {
    const m = lit.match(tpl.re);
    if (m) {
      const vars = tpl.vars.map((v, i) => `${v}: String(${JSON.stringify(m[i + 1])})`).join(', ');
      return `t(labels, '${tpl.key}', { ${vars} })`;
    }
  }
  // Generic ${var} patterns in known keys
  const inner = lit.slice(1, -1);
  if (!inner.includes('${')) {
    const k = keyFor(inner);
    if (k) return `t(labels, '${k}')`;
  }
  return null;
}

function transform(content) {
  let out = content;
  const texts = Object.keys(keyMap).sort((a, b) => b.length - a.length);

  for (const text of texts) {
    const key = keyMap[text];
    const esc = escRe(text);

    out = out.replace(new RegExp(`(\\w+)=["']${esc}["']`, 'g'), `$1={t(labels, '${key}')}`);
    out = out.replace(new RegExp(`>\\s*${esc}\\s*<`, 'g'), `>{t(labels, '${key}')}<`);
    out = out.replace(
      new RegExp(`(\\(|,\\s*|\\?\\s*|:\\s*|=\\s*)['"]${esc}['"]`, 'g'),
      `$1t(labels, '${key}')`,
    );
    out = out.replace(new RegExp(`return\\s+['"]${esc}['"]`, 'g'), `return t(labels, '${key}')`);
  }

  // Template literals
  out = out.replace(/`[^`]*[\u4e00-\u9fff][^`]*`/g, (lit) => {
    const repl = transformTemplateLiteral(lit);
    return repl ?? lit;
  });

  // JSX mixed: 状态:{' '}
  if (keyMap['状态']) {
    out = out.replace(/>\s*状态:\{' '\}/g, ">{t(labels, 'auto.t_62e951a6')}:{' '}");
  }

  // summary with count
  out = out.replace(
    /<summary>失败节点 \(\{failedNodes\.length\}\)<\/summary>/g,
    "<summary>{t(labels, 'executions.failedNodes', { count: String(failedNodes.length) })}</summary>",
  );

  return out;
}

const root = 'apps/web/src';
const skip = new Set([
  'features/editor/node-type-meta.ts',
  'features/editor/node-param-schemas.ts',
  'features/editor/node-port-defs.ts',
]);

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

// Also fix client.ts
const clientPath = 'apps/web/src/api/client.ts';
let client = fs.readFileSync(clientPath, 'utf8');
client = client.replace(
  "'无法连接 API（http://localhost:8787）。请在项目根目录执行 pnpm dev 同时启动前后端。',",
  "clientI18n('api.error.connection'),",
);
fs.writeFileSync(clientPath, client);
console.log('client.ts fixed');
