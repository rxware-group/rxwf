#!/usr/bin/env node
/**
 * Dev-leader one-shot generator for docs/workflow/tasks/T-*.md
 * Run: node scripts/generate-task-files.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs/workflow/tasks');

const NODES = [
  { type: 'manualTrigger', cat: 'trigger', track: 'lite', exec: 'packages/node-runner/src/executors/triggers/manual.ts' },
  { type: 'webhookTrigger', cat: 'trigger', track: 'lite', exec: 'packages/node-runner/src/executors/triggers/webhook.ts' },
  { type: 'scheduleTrigger', cat: 'trigger', track: 'lite', exec: 'packages/node-runner/src/executors/triggers/schedule.ts' },
  { type: 'errorTrigger', cat: 'trigger', track: 'lite', exec: 'packages/node-runner/src/executors/triggers/error.ts' },
  { type: 'subworkflowTrigger', cat: 'trigger', track: 'plus', exec: 'packages/node-runner/src/executors/triggers/subworkflow.ts' },
  { type: 'if', cat: 'logic', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/if.ts' },
  { type: 'switch', cat: 'logic', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/switch.ts' },
  { type: 'merge', cat: 'logic', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/merge.ts' },
  { type: 'loop', cat: 'logic', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/loop.ts' },
  { type: 'humanApproval', cat: 'logic', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/human-approval.ts' },
  { type: 'splitInBatches', cat: 'logic', track: 'plus', exec: 'packages/node-runner/src/executors/control-flow/split-in-batches.ts' },
  { type: 'set', cat: 'data', track: 'lite', exec: 'packages/node-runner/src/executors/transform/set.ts' },
  { type: 'json', cat: 'data', track: 'lite', exec: 'packages/node-runner/src/executors/transform/json.ts' },
  { type: 'httpRequest', cat: 'action', track: 'lite', exec: 'packages/node-runner/src/executors/http.ts' },
  { type: 'wait', cat: 'action', track: 'lite', exec: 'packages/node-runner/src/executors/control-flow/wait.ts' },
  { type: 'code', cat: 'action', track: 'lite', exec: 'packages/node-runner/src/executors/code.ts' },
  { type: 'executeCommand', cat: 'action', track: 'lite', exec: 'packages/node-runner/src/executors/execute-command.ts' },
  { type: 'executeWorkflow', cat: 'action', track: 'lite', exec: 'packages/node-runner/src/executors/subworkflow.ts' },
  { type: 'readWriteFile', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/read-write-file.ts' },
  { type: 'postgres', cat: 'action', track: 'standard', exec: 'packages/node-runner/src/executors/postgres.ts' },
  { type: 'llm', cat: 'action', track: 'standard', exec: 'packages/node-runner/src/executors/llm.ts' },
  { type: 'llmStream', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/llm-stream.ts' },
  { type: 'ragRetrieve', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/rag.ts' },
  { type: 'ragAnswer', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/rag.ts' },
  { type: 'mcpClient', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/mcp-client.ts' },
  { type: 'workflow_run', cat: 'action', track: 'plus', exec: 'packages/node-runner/src/executors/workflow-run.ts' },
  { type: 'crewSequential', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/crew-sequential.ts' },
  { type: 'crewHierarchical', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/crew-hierarchical.ts' },
  { type: 'crewSupervisor', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/crew-supervisor.ts' },
  { type: 'groupChat', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/group-chat.ts' },
  { type: 'aiAgent', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/run-ai-agent-node.ts' },
  { type: 'aiChatModel', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'aiMemory', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'aiKnowledge', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/crew-knowledge-bridge.ts' },
  { type: 'aiOutputParser', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolMcp', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolHttp', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolWorkflow', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/run-subagent-tool.ts' },
  { type: 'toolSkill', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/run-skill-tool.ts' },
  { type: 'toolSubagent', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/run-subagent-tool.ts' },
  { type: 'toolRead', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolWrite', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolGrep', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolShell', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'toolWebSearch', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/agent-satellite-tools.ts' },
  { type: 'skillRun', cat: 'agent', track: 'plus', exec: 'packages/node-runner/src/executors/skill-run.ts' },
];

function fmtTask(t) {
  const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const red = Array.isArray(t.red) ? t.red.map((r) => `• ${r}`).join('<br>') : t.red;
  const tests = Array.isArray(t.tests) ? t.tests.map((x) => `• ${x}`).join('<br>') : t.tests;
  const ownership = Array.isArray(t.ownership) ? t.ownership.map((x) => `• ${x}`).join('<br>') : t.ownership;
  const ac = Array.isArray(t.ac) ? t.ac.join(', ') : t.ac;
  const fr = Array.isArray(t.fr) ? t.fr.join(', ') : t.fr;
  const deps = t.deps?.length ? t.deps.join(', ') : '-';

  return `# ${t.id}

> 任务详情文件。开发阶段由被指派的 developer 独占写入；编排器负责合并到 \`tasks.md\` 索引。

## 元数据（dev-leader 填写，开发阶段只读）

| 字段 | 值 |
|------|-----|
| Milestone | ${t.milestone} |
| Wave | ${t.wave} |
| 描述 | ${t.desc} |
| 追溯 | ${fr} / ${ac} / ${t.arch} |
| 依赖 | ${deps} |
| TDD Red 用例 | ${cell(red)} |
| 建议测试文件 | ${cell(tests)} |
| 文件所有权 | ${cell(ownership)} |
| 验收标准 | ${t.done} |
| 基本验证提示 | ${t.verify} |

## 状态

\`todo\`

## TDD 证据（developer 填写）

### Red

- 测试文件：
- 运行命令：
- 失败摘要（预期内）：

### Green

- 实现文件：
- 运行命令：
- 通过摘要：

### Refactor

- 变更说明：

## Task 基本验证（developer 填写，Verify 步骤）

| 验证项 | 命令 | 结果 | 满足验收标准 |
|--------|------|------|--------------|
| 任务范围测试 | | | 是/否 |
| linter/build | | | 是/否 |
| 冒烟（若适用） | | | 是/否 |

**结论**：\`passed\` | \`failed\`

## 实际变更文件

-

## 实现说明

-

## 未解决问题

-
`;
}

/** @type {import('./types').TaskDef[]} */
const STATIC = [
  // M-1
  { id: 'T-001', milestone: 'M-1', wave: 1, desc: '增强 docs/README.md：分类目录、每文件一行摘要、维护规则', fr: 'FR-01', ac: 'AC-002', arch: '§10 文档索引', deps: [], red: ['lint-docs-index 或 README 结构测试应失败直至 README 含 categories 与 maintenance 节'], tests: ['scripts/lint-docs-index.test.mjs（新增）或 docs/README 快照测试'], ownership: ['docs/README.md', 'docs/README.test.md（可选）'], done: 'README 满足 AC-002；Verify passed', verify: '人工打开 README 核对分类与维护规则' },
  { id: 'T-002', milestone: 'M-1', wave: 1, desc: '创建 docs/INDEX.md：YAML frontmatter + 人类可读总目录骨架', fr: 'FR-01', ac: 'AC-001', arch: '§10.2 INDEX 规范', deps: [], red: ['INDEX 解析测试：缺少 frontmatter.version 应失败', 'entries 数组为空应失败'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['docs/INDEX.md'], done: 'INDEX.md 存在且 frontmatter 合法；Verify passed', verify: 'node scripts/lint-docs-index.mjs --check docs/INDEX.md' },
  { id: 'T-003', milestone: 'M-1', wave: 1, desc: '运行 spec-reviewer 流程产出 v2.0 差距矩阵（纳入审计引用）', fr: 'FR-02', ac: 'AC-009', arch: '§5 M-1 差距审计', deps: [], red: ['spec-gap-audit 引用检查：缺少 spec-reviewer 产出路径应失败'], tests: ['docs/workflow/spec-gap-audit.review.test.mjs（引用存在性）'], ownership: ['docs/workflow/spec-gap-reviewer-output.md', 'docs/workflow/spec-gap-audit.md（仅引用节，正文由 T-007 完成）'], done: 'reviewer 产出物存在且被 audit 引用', verify: '检查 reviewer 输出表格行数 > 0' },
  { id: 'T-004', milestone: 'M-1', wave: 1, desc: '初始化 docs/test/e2e-coverage-matrix.md（v2.0 全功能行 + 列定义）', fr: 'FR-03', ac: 'AC-007, AC-008', arch: '§3.3 E2E 矩阵', deps: [], red: ['matrix 校验脚本：行数 < 45 nodeType + 平台能力应失败', '缺少 track 列应失败'], tests: ['scripts/validate-e2e-matrix.test.mjs'], ownership: ['docs/test/e2e-coverage-matrix.md', 'scripts/validate-e2e-matrix.mjs'], done: '矩阵含全 v2.0 功能行与必需列；初始状态可为 uncovered', verify: 'node scripts/validate-e2e-matrix.mjs' },
  { id: 'T-005', milestone: 'M-1', wave: 1, desc: '实现 scripts/lint-docs-index.mjs 与单元测试（未登记 md 失败）', fr: 'FR-04', ac: 'AC-004', arch: '§10.3 CI 校验', deps: [], red: ['新增未登记 docs/foo.md 时 lint 应 exit 1', '已登记 INDEX 条目应 exit 0'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['scripts/lint-docs-index.mjs', 'scripts/lint-docs-index.test.mjs'], done: '脚本本地可重复；P95 < 30s；Verify passed', verify: 'node scripts/lint-docs-index.test.mjs' },
  { id: 'T-006', milestone: 'M-1', wave: 1, desc: '实现 scripts/e2e-compose.mjs（up/down/wait-health）', fr: 'FR-14', ac: 'AC-073', arch: '§6.3 Docker harness', deps: [], red: ['e2e-compose healthcheck 超时未就绪应失败', 'down 后容器仍存在应失败'], tests: ['scripts/e2e-compose.test.mjs'], ownership: ['scripts/e2e-compose.mjs', 'scripts/e2e-compose.test.mjs'], done: 'standard/plus compose 可启停；Verify passed', verify: 'node scripts/e2e-compose.mjs up standard --dry-run（或集成测）' },
  { id: 'T-007', milestone: 'M-1', wave: 2, desc: '各 docs 子目录 README 增加链回 INDEX.md', fr: 'FR-01', ac: 'AC-003', arch: '§10.1 结构', deps: ['T-002'], red: ['子目录 README 缺少 INDEX 链接应被 lint 捕获'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['docs/architecture/README.md', 'docs/requirements/README.md', 'docs/test/README.md', 'docs/help/README.md', 'docs/workflow/README.md'], done: '主要子目录 README 均链回 INDEX', verify: 'pnpm lint:docs-index' },
  { id: 'T-008', milestone: 'M-1', wave: 2, desc: '编写 docs/workflow/spec-gap-audit.md 完整差距表', fr: 'FR-02', ac: 'AC-005, AC-006', arch: '§5 M-1', deps: ['T-003', 'T-004'], red: ['audit 行缺少 milestone 列应失败', 'open 半实现项无目标 M 应失败'], tests: ['scripts/validate-spec-gap-audit.test.mjs'], ownership: ['docs/workflow/spec-gap-audit.md', 'scripts/validate-spec-gap-audit.mjs'], done: '全 v2.0 能力有行；含 spec/现状/M/E2E 行 ID', verify: 'node scripts/validate-spec-gap-audit.mjs' },
  { id: 'T-009', milestone: 'M-1', wave: 2, desc: 'package.json + CI 集成 pnpm lint:docs-index', fr: 'FR-04', ac: 'AC-004', arch: '§10.3', deps: ['T-005'], red: ['CI workflow 未调用 lint:docs-index 时门禁测试失败'], tests: ['.github/workflows/*.yml 快照或 ci-docs-index.test.mjs'], ownership: ['package.json', '.github/workflows/ci.yml（或等效 CI 配置）'], done: 'PR 未登记 md 阻塞合并', verify: 'pnpm lint:docs-index' },
  { id: 'T-010', milestone: 'M-1', wave: 2, desc: 'INDEX.md 补充 FR 编号与 nodeType 交叉引用入口', fr: 'FR-01', ac: 'AC-012', arch: '§10.2', deps: ['T-002', 'T-008'], red: ['INDEX 缺少 fr/nodeType 索引节应失败'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['docs/INDEX.md'], done: 'AC-012 可导航至 FR 与 nodeType', verify: '人工 + lint:docs-index' },
  { id: 'T-011', milestone: 'M-1', wave: 3, desc: '扩展 apps/web/e2e/global-setup.ts：compose 生命周期 + auth', fr: 'FR-14', ac: 'AC-073', arch: '§6.4 global-setup', deps: ['T-006'], red: ['RXWF_E2E_TRACK=standard 时未调用 compose up 应失败（mock 测试）'], tests: ['apps/web/e2e/global-setup.test.ts'], ownership: ['apps/web/e2e/global-setup.ts', 'apps/web/e2e/global-setup.test.ts'], done: 'setup 按 track 启 compose 并写 .e2e-env', verify: 'RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e --grep @smoke' },
  { id: 'T-012', milestone: 'M-1', wave: 3, desc: '实现 global-teardown：compose down -v + 无容器泄漏检查', fr: 'FR-14', ac: 'AC-073', arch: '§6.3 teardown', deps: ['T-006'], red: ['teardown 后 docker ps 仍含 rxwf-e2e 容器应失败'], tests: ['apps/web/e2e/global-teardown.test.ts'], ownership: ['apps/web/e2e/global-teardown.ts', 'apps/web/e2e/global-teardown.test.ts'], done: 'AC-073 可验证', verify: '跑 E2E 后 docker ps 无残留' },
  { id: 'T-013', milestone: 'M-1', wave: 3, desc: 'playwright.config.ts 支持 RXWF_E2E_TRACK 双轨 project', fr: 'FR-14', ac: 'AC-011', arch: '§6.4 config', deps: ['T-006'], red: ['缺少 standard/plus project 定义应失败'], tests: ['apps/web/playwright.config.test.ts'], ownership: ['apps/web/playwright.config.ts', 'apps/web/playwright.config.test.ts'], done: 'Standard/Plus/Lite 项目可区分', verify: 'pnpm --filter @rxwf/web exec playwright test --list' },
  { id: 'T-014', milestone: 'M-1', wave: 4, desc: 'M-1 基线 E2E：帮助路由 + 索引/文档 smoke', fr: 'FR-13', ac: 'AC-011', arch: '§3.2 帮助加载', deps: ['T-009', 'T-011'], red: ['/help 路由 404 应失败', '已有 manual 节点 E2E 回归失败应修复'], tests: ['apps/web/e2e/help-route-baseline.spec.ts', 'apps/web/e2e/docs-index-smoke.spec.ts'], ownership: ['apps/web/e2e/help-route-baseline.spec.ts', 'apps/web/e2e/docs-index-smoke.spec.ts'], done: 'M-1 E2E 入库且全量套件 green', verify: 'pnpm --filter @rxwf/web test:e2e' },
  { id: 'T-015', milestone: 'M-1', wave: 4, desc: '编写 docs/test/milestones/M-1-acceptance.md 人工验收用例', fr: 'FR-12', ac: 'AC-010, AC-070', arch: '§9 人工验收', deps: ['T-008', 'T-014'], red: ['acceptance 缺少 AC-001～012 映射应被 checklist lint 失败'], tests: ['scripts/validate-milestone-acceptance.test.mjs'], ownership: ['docs/test/milestones/M-1-acceptance.md'], done: '人工用例覆盖 M-1 全部 AC 功能面', verify: '人工抽检用例可执行' },

  // M-2
  { id: 'T-016', milestone: 'M-2', wave: 1, desc: 'skillRun toolWrite provider 补齐至 spec AC', fr: 'FR-05', ac: 'AC-013', arch: 'M-2 skill-runtime', deps: [], red: ['write 工具未注册时 skillRun 应 E104x 失败', '写入文件后应可读回内容'], tests: ['packages/skill-runtime/src/tools/write.test.ts', 'packages/node-runner/src/executors/skill-run.test.ts'], ownership: ['packages/skill-runtime/src/tools/write.ts', 'packages/skill-runtime/src/tools/write.test.ts'], done: 'write 子能力 green + Verify', verify: 'pnpm --filter @rxwf/skill-runtime test' },
  { id: 'T-017', milestone: 'M-2', wave: 1, desc: 'skillRun toolGrep provider 补齐至 spec AC', fr: 'FR-05', ac: 'AC-013', arch: 'M-2 skill-runtime', deps: [], red: ['grep 无匹配应返回空数组非 throw', '正则非法应 E200x'], tests: ['packages/skill-runtime/src/tools/grep.test.ts'], ownership: ['packages/skill-runtime/src/tools/grep.ts', 'packages/skill-runtime/src/tools/grep.test.ts'], done: 'grep 子能力 green', verify: 'pnpm --filter @rxwf/skill-runtime test grep' },
  { id: 'T-018', milestone: 'M-2', wave: 1, desc: 'skillRun toolWebSearch provider 补齐至 spec AC', fr: 'FR-05', ac: 'AC-013', arch: 'M-2 skill-runtime', deps: [], red: ['未配置 provider 应失败', 'mock provider 返回 citations'], tests: ['packages/skill-runtime/src/tools/web-search.test.ts', 'packages/node-runner/src/executors/resolve-web-search-provider-config.test.ts'], ownership: ['packages/skill-runtime/src/tools/web-search.ts', 'packages/skill-runtime/src/tools/web-search.test.ts'], done: 'web_search 子能力 green', verify: 'pnpm --filter @rxwf/skill-runtime test web-search' },
  { id: 'T-019', milestone: 'M-2', wave: 1, desc: 'credential-types 类型注册表与字段 schema 落地', fr: 'FR-05', ac: 'AC-015', arch: 'packages/credential', deps: [], red: ['未注册 type 保存应校验失败', 'oauth2 字段缺失应失败'], tests: ['packages/credential/src/types/registry.test.ts'], ownership: ['packages/credential/src/types/registry.ts', 'packages/credential/src/types/generic/*.ts'], done: 'credential-types spec AC 单测 green', verify: 'pnpm --filter @rxwf/credential test' },
  { id: 'T-020', milestone: 'M-2', wave: 1, desc: 'credential-types API 路由与 apply-auth 集成', fr: 'FR-05', ac: 'AC-015', arch: 'apps/api credential', deps: [], red: ['POST credential 未加密存储应失败', 'apply-auth 未注入 header 应失败'], tests: ['apps/api/src/routes/credentials.test.ts', 'packages/credential/src/apply-auth.test.ts'], ownership: ['apps/api/src/routes/credentials.ts', 'apps/api/src/routes/credentials.test.ts'], done: 'API CRUD + apply-auth green', verify: 'pnpm --filter @rxwf/api test credentials' },
  { id: 'T-021', milestone: 'M-2', wave: 1, desc: 'switch 动态分支：workflow 图校验与保存规则', fr: 'FR-05', ac: 'AC-016', arch: 'packages/workflow switch', deps: [], red: ['动态分支表达式为空应校验失败', '输出端口数与规则不匹配应失败'], tests: ['packages/workflow/src/validate-switch.test.ts'], ownership: ['packages/workflow/src/validate-switch.ts', 'packages/workflow/src/validate-switch.test.ts'], done: 'switch 校验 green', verify: 'pnpm --filter @rxwf/workflow test validate-switch' },
  { id: 'T-022', milestone: 'M-2', wave: 1, desc: 'switch 动态分支：执行器路由逻辑', fr: 'FR-05', ac: 'AC-016', arch: 'node-runner switch', deps: [], red: ['多分支匹配应仅走第一 true', '无匹配应丢弃 item'], tests: ['packages/node-runner/src/executors/control-flow/switch.test.ts'], ownership: ['packages/node-runner/src/executors/control-flow/switch.ts', 'packages/node-runner/src/executors/control-flow/switch.test.ts'], done: 'switch 执行 green', verify: 'pnpm --filter @rxwf/node-runner test switch' },
  { id: 'T-023', milestone: 'M-2', wave: 1, desc: 'switch 动态分支：编辑器 SwitchBranchesPanel UI', fr: 'FR-05', ac: 'AC-016', arch: 'apps/web editor', deps: [], red: ['动态规则 UI 未渲染应失败（组件测试）', '保存后 branches 丢失应失败'], tests: ['apps/web/src/features/editor/SwitchBranchesPanel.test.tsx'], ownership: ['apps/web/src/features/editor/SwitchBranchesPanel.tsx', 'apps/web/src/features/editor/switch-branches.ts'], done: '面板可配置动态分支', verify: 'pnpm --filter @rxwf/web test SwitchBranches' },
  { id: 'T-024', milestone: 'M-2', wave: 1, desc: '工作流 ACL：identity workflow-access API 路由', fr: 'FR-05', ac: 'AC-014', arch: 'packages/identity ACL', deps: [], red: ['Viewer 调用 DELETE workflow 应 403', 'Owner 可 share'], tests: ['packages/identity/src/workflow-access-service.test.ts', 'apps/api/src/routes/workflow-collaborators.test.ts'], ownership: ['apps/api/src/routes/workflow-collaborators.ts', 'apps/api/src/routes/workflow-collaborators.test.ts'], done: 'Owner/Editor/Viewer API green', verify: 'pnpm --filter @rxwf/api test collaborators' },
  { id: 'T-025', milestone: 'M-2', wave: 1, desc: '工作流 ACL：WorkflowCollaboratorsPanel UI', fr: 'FR-05', ac: 'AC-014', arch: 'apps/web editor', deps: [], red: ['无 share 权限不显示邀请按钮', '角色变更应调用 API'], tests: ['apps/web/src/features/editor/WorkflowCollaboratorsPanel.test.tsx'], ownership: ['apps/web/src/features/editor/WorkflowCollaboratorsPanel.tsx', 'apps/web/src/features/editor/WorkflowCollaboratorsPanel.test.tsx'], done: 'ACL UI green', verify: 'pnpm --filter @rxwf/web test WorkflowCollaborators' },
  { id: 'T-026', milestone: 'M-2', wave: 2, desc: 'skillRun 执行器集成 write/grep/web_search 子工具', fr: 'FR-05', ac: 'AC-013', arch: 'skill-run executor', deps: ['T-016', 'T-017', 'T-018'], red: ['skillRun 调用 write 工具端到端应成功'], tests: ['packages/node-runner/src/executors/skill-run.test.ts'], ownership: ['packages/node-runner/src/executors/skill-run.ts', 'packages/node-runner/src/executors/skill-run.test.ts'], done: 'AC-013 skillRun 集成 green', verify: 'pnpm --filter @rxwf/node-runner test skill-run' },
  { id: 'T-027', milestone: 'M-2', wave: 2, desc: 'credential-types Web 设置页与节点引用 UI', fr: 'FR-05', ac: 'AC-015', arch: 'apps/web settings', deps: ['T-019', 'T-020'], red: ['节点选 credential 下拉为空应失败'], tests: ['apps/web/src/features/settings/CredentialsPanel.test.tsx'], ownership: ['apps/web/src/features/settings/CredentialsPanel.tsx', 'apps/web/src/features/settings/credential-types.ts'], done: '凭证 UI green', verify: 'pnpm --filter @rxwf/web test Credentials' },
  { id: 'T-028', milestone: 'M-2', wave: 2, desc: 'M-2 E2E：skillRun 子能力场景', fr: 'FR-13', ac: 'AC-018', arch: 'E2E Plus', deps: ['T-026'], red: ['skillRun E2E 未覆盖 matrix 行应失败'], tests: ['apps/web/e2e/skill-run-tools.spec.ts'], ownership: ['apps/web/e2e/skill-run-tools.spec.ts'], done: 'matrix skillRun 行 covered', verify: 'RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e skill-run' },
  { id: 'T-029', milestone: 'M-2', wave: 2, desc: 'M-2 E2E：工作流 ACL 场景', fr: 'FR-13', ac: 'AC-018', arch: 'E2E Standard', deps: ['T-024', 'T-025'], red: ['Viewer 编辑工作流 E2E 应被阻止'], tests: ['apps/web/e2e/workflow-acl.spec.ts'], ownership: ['apps/web/e2e/workflow-acl.spec.ts'], done: 'matrix ACL 行 covered', verify: 'pnpm --filter @rxwf/web test:e2e workflow-acl' },
  { id: 'T-030', milestone: 'M-2', wave: 2, desc: 'M-2 E2E：credential-types + switch 动态分支', fr: 'FR-13', ac: 'AC-018', arch: 'E2E', deps: ['T-021', 'T-022', 'T-023', 'T-027'], red: ['switch 多分支 E2E 未路由正确应失败'], tests: ['apps/web/e2e/credential-types.spec.ts', 'apps/web/e2e/switch-dynamic.spec.ts'], ownership: ['apps/web/e2e/credential-types.spec.ts', 'apps/web/e2e/switch-dynamic.spec.ts'], done: 'M-2 功能 matrix 100% covered', verify: 'pnpm --filter @rxwf/web test:e2e' },
  { id: 'T-031', milestone: 'M-2', wave: 3, desc: 'schemaVersion:1 工作流导入回归测试（M-2 变更）', fr: 'FR-17', ac: 'AC-021', arch: 'packages/workflow', deps: ['T-026', 'T-030'], red: ['fixtures/v1 工作流导入失败应报错'], tests: ['packages/workflow/src/schema-compat.test.ts'], ownership: ['packages/workflow/src/schema-compat.test.ts', 'packages/workflow/fixtures/schema-v1/*.json'], done: 'AC-021 green', verify: 'pnpm --filter @rxwf/workflow test schema-compat' },
  { id: 'T-032', milestone: 'M-2', wave: 3, desc: '更新 spec-gap-audit M-2 项为 done + matrix 覆盖状态', fr: 'FR-02', ac: 'AC-017, AC-018', arch: 'gap audit', deps: ['T-028', 'T-029', 'T-030'], red: ['M-2 行仍为 open 应被 validate 失败'], tests: ['scripts/validate-spec-gap-audit.test.mjs'], ownership: ['docs/workflow/spec-gap-audit.md', 'docs/test/e2e-coverage-matrix.md'], done: 'AC-017/018 satisfied', verify: 'node scripts/validate-spec-gap-audit.mjs --milestone M-2' },
  { id: 'T-033', milestone: 'M-2', wave: 3, desc: 'M-2 帮助/INDEX 同步（参数变更项）+ M-2-acceptance.md', fr: 'FR-15', ac: 'AC-022, AC-019, AC-070', arch: '文档同步', deps: ['T-032'], red: ['变更节点 help 未更新应被 lint 失败'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['docs/help/zh/nodes/switch.md', 'docs/help/zh/nodes/skillRun.md', 'docs/test/milestones/M-2-acceptance.md', 'docs/INDEX.md'], done: 'M-2 文档与验收清单就绪', verify: 'pnpm lint:docs-index' },

  // M-4 (after M-3 nodes - numbering continues after node tasks)
];

// M-3 matrix scaffold
STATIC.push({
  id: 'T-034',
  milestone: 'M-3',
  wave: 1,
  desc: '生成节点审查矩阵脚手架（45 type × 面板/校验/执行器/错误码）',
  fr: 'FR-09',
  ac: 'AC-023, AC-034',
  arch: '§5 M-3 节点矩阵',
  deps: ['T-033'],
  red: ['矩阵行数 !== 45 应失败', 'executor registry 与 meta 不一致应失败'],
  tests: ['scripts/generate-node-audit-matrix.test.mjs'],
  ownership: ['docs/test/node-audit-matrix.md', 'scripts/generate-node-audit-matrix.mjs'],
  done: '双源一致的可编辑矩阵',
  verify: 'node scripts/generate-node-audit-matrix.mjs --check',
});

// M-3 per-node tasks T-035 .. T-079 (45 nodes)
let nodeTaskId = 35;
const nodeWaveMap = { lite: 2, standard: 3, plus: 4 };
for (const n of NODES) {
  const id = `T-${String(nodeTaskId).padStart(3, '0')}`;
  const wave = nodeWaveMap[n.track] ?? 2;
  const e2e = `apps/web/e2e/nodes/${n.type}.spec.ts`;
  const auditRow = `docs/test/node-audit-rows/${n.type}.md`;
  STATIC.push({
    id,
    milestone: 'M-3',
    wave,
    desc: `审查并修复 nodeType \`${n.type}\`：面板/校验/执行器/错误码 + E2E`,
    fr: 'FR-09, FR-18',
    ac: n.track === 'standard' ? 'AC-024, AC-025, AC-028, AC-030' : n.track === 'plus' ? 'AC-027, AC-028, AC-030' : 'AC-024, AC-028, AC-030',
    arch: `node-runner ${n.type}`,
    deps: ['T-034'],
    red: [
      `\`${n.type}\` 执行器未注册应失败`,
      `面板渲染快照/校验测试失败直至修复`,
      `E2E ${n.type} spec 应失败直至节点可执行`,
    ],
    tests: [
      `${n.exec.replace('.ts', '.test.ts')}（或新建）`,
      e2e,
    ],
    ownership: [
      n.exec,
      `${n.exec.replace('.ts', '.test.ts')}`,
      e2e,
      auditRow,
      `apps/web/src/features/editor/node-params/${n.type}.tsx（若存在）`,
    ],
    done: `matrix 行 covered；审查行有结论；${n.track} 轨验收通过`,
    verify: n.track === 'plus' ? `RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e ${n.type}` : n.track === 'standard' ? `RXWF_E2E_TRACK=standard pnpm --filter @rxwf/web test:e2e ${n.type}` : `pnpm --filter @rxwf/web test:e2e ${n.type}`,
  });
  nodeTaskId++;
}

// M-3 closure T-080 .. T-084
STATIC.push(
  { id: 'T-080', milestone: 'M-3', wave: 5, desc: '合并 node-audit-rows 至 node-audit-matrix.md（100% 结论）', fr: 'FR-09', ac: 'AC-023, AC-033', arch: 'M-3 矩阵', deps: ['T-079'], red: ['存在 pending 审查行应失败'], tests: ['scripts/validate-node-audit-matrix.test.mjs'], ownership: ['docs/test/node-audit-matrix.md', 'scripts/validate-node-audit-matrix.mjs'], done: 'AC-023 100% 有结论', verify: 'node scripts/validate-node-audit-matrix.mjs' },
  { id: 'T-081', milestone: 'M-3', wave: 5, desc: '更新 e2e-coverage-matrix 全部 nodeType 行', fr: 'FR-18', ac: 'AC-029', arch: 'E2E matrix', deps: ['T-079'], red: ['nodeType 行 status !== covered 应失败'], tests: ['scripts/validate-e2e-matrix.test.mjs'], ownership: ['docs/test/e2e-coverage-matrix.md'], done: 'AC-029 green', verify: 'node scripts/validate-e2e-matrix.mjs --nodes' },
  { id: 'T-082', milestone: 'M-3', wave: 5, desc: 'error-codes.md 与节点失败码映射补全', fr: 'FR-09', ac: 'AC-030', arch: 'docs/error-codes', deps: ['T-079'], red: ['节点 E2xx 未文档化应失败'], tests: ['scripts/validate-error-codes.test.mjs'], ownership: ['docs/error-codes.md', 'scripts/validate-error-codes.mjs'], done: '失败可诊断', verify: 'node scripts/validate-error-codes.mjs' },
  { id: 'T-083', milestone: 'M-3', wave: 5, desc: '编写 M-3-acceptance.md（45 nodeType 人工用例）', fr: 'FR-12', ac: 'AC-031, AC-070', arch: '人工验收', deps: ['T-080'], red: ['nodeType 缺少人工用例应失败'], tests: ['scripts/validate-milestone-acceptance.test.mjs'], ownership: ['docs/test/milestones/M-3-acceptance.md'], done: 'AC-031 就绪', verify: '人工抽检' },
  { id: 'T-084', milestone: 'M-3', wave: 5, desc: 'M-3 全量 E2E 双轨回归 + spec-gap 节点项 done', fr: 'FR-13', ac: 'AC-032, AC-033, AC-020', arch: 'M-3 门禁', deps: ['T-081', 'T-082', 'T-083'], red: ['全量 E2E 任一失败'], tests: ['apps/web/e2e/**/*.spec.ts'], ownership: ['docs/workflow/spec-gap-audit.md', 'docs/test/milestones/M-3-report.md'], done: 'M-3 E2E 全绿', verify: 'RXWF_E2E_TRACK=standard && plus 各跑全量' },
);

// M-4 Group Chat
const M4 = [
  { id: 'T-085', wave: 1, desc: 'Group Chat 架构冲突评估文档（Crew/Agent 共存）', ac: 'AC-038', ownership: ['docs/architecture/group-chat-conflict-review.md'], deps: ['T-084'], red: ['未记录冲突评估应阻塞 M-4 实现测试'], tests: ['docs/architecture/group-chat-conflict-review.test.mjs'] },
  { id: 'T-086', wave: 1, desc: 'groupChat 参数 schema 与面板校验（含 UserProxy 默认 -1）', ac: 'AC-043', ownership: ['packages/workflow/src/validate-group-chat.ts', 'apps/web/src/features/editor/group-chat-params.ts'], deps: ['T-085'], red: ['userProxyTimeoutMs 默认 !== -1 应失败'] },
  { id: 'T-087', wave: 1, desc: 'groupChat round-robin 执行器 native loop', ac: 'AC-035', ownership: ['packages/node-runner/src/executors/group-chat.ts', 'packages/node-runner/src/executors/group-chat.test.ts'], deps: ['T-085'], red: ['roundRobin 未轮流发言应失败'] },
  { id: 'T-088', wave: 1, desc: 'groupChat orchestrator 模式（LLM JSON 调度）', ac: 'AC-036', ownership: ['packages/node-runner/src/executors/group-chat-orchestrator.ts', 'packages/node-runner/src/executors/group-chat-orchestrator.test.ts'], deps: ['T-085'], red: ['orchestrator 无 finish 动作应死循环检测失败'] },
  { id: 'T-089', wave: 1, desc: 'ai-runtime runGroupChatGraph 适配层（可选路径）', ac: 'AC-035, AC-036', ownership: ['packages/ai-runtime/src/agents/group-chat-agent.ts', 'packages/ai-runtime/src/agents/group-chat-agent.test.ts'], deps: ['T-085'], red: ['graph 入口未导出应失败'] },
  { id: 'T-090', wave: 2, desc: 'UserProxy HITL waiting + resume 路径', ac: 'AC-037', ownership: ['packages/execution/src/hitl/group-chat-user-proxy.ts', 'apps/api/src/routes/hitl-resume-group-chat.test.ts'], deps: ['T-086', 'T-087'], red: ['resume 未 append user 消息应失败'] },
  { id: 'T-091', wave: 2, desc: 'UserProxy 超时失败终止（>0 超时，默认 -1 不超时）', ac: 'AC-037', ownership: ['packages/execution/src/hitl/group-chat-timeout.ts', 'packages/execution/src/hitl/group-chat-timeout.test.ts'], deps: ['T-090'], red: ['超时后仍 waiting 应失败', '默认 -1 不触发 sweeper'] },
  { id: 'T-092', wave: 2, desc: 'Group Chat agentSteps 审计事件', ac: 'AC-035, AC-037', ownership: ['packages/node-runner/src/executors/group-chat-helpers.ts', 'packages/node-runner/src/executors/group-chat-helpers.test.ts'], deps: ['T-087', 'T-088'], red: ['缺少 groupChatUserProxy  step 应失败'] },
  { id: 'T-093', wave: 3, desc: 'API orchestrationResume kind=groupChat 集成', ac: 'AC-037', ownership: ['apps/api/src/routes/hitl-resume.ts', 'apps/api/src/integration/group-chat.integration.test.ts'], deps: ['T-090', 'T-091'], red: ['resume 404 应失败'] },
  { id: 'T-094', wave: 3, desc: 'E2E Group Chat round-robin（Plus 轨）', ac: 'AC-039', ownership: ['apps/web/e2e/group-chat-round-robin.spec.ts'], deps: ['T-087', 'T-093'], red: ['E2E 未 green'] },
  { id: 'T-095', wave: 3, desc: 'E2E Group Chat orchestrator + UserProxy', ac: 'AC-039, AC-040', ownership: ['apps/web/e2e/group-chat-orchestrator-user-proxy.spec.ts'], deps: ['T-088', 'T-090', 'T-093'], red: ['UserProxy 插话 E2E 失败'] },
  { id: 'T-096', wave: 4, desc: 'matrix Group Chat 行 100% + spec-gap done', ac: 'AC-040, AC-044', ownership: ['docs/test/e2e-coverage-matrix.md', 'docs/workflow/spec-gap-audit.md'], deps: ['T-094', 'T-095'], red: ['groupChat 行未 covered'] },
  { id: 'T-097', wave: 4, desc: 'M-4-acceptance.md 人工验收用例', ac: 'AC-041, AC-070', ownership: ['docs/test/milestones/M-4-acceptance.md'], deps: ['T-095'], red: ['缺少 Plus 轨用例'] },
  { id: 'T-098', wave: 4, desc: 'M-4 全量 E2E 回归', ac: 'AC-042', ownership: ['docs/test/milestones/M-4-report.md'], deps: ['T-096', 'T-097'], red: ['全量 E2E 失败'] },
];
for (const m of M4) {
  STATIC.push({
    milestone: 'M-4',
    fr: 'FR-10',
    arch: '§8 Group Chat',
    tests: m.tests ?? [`${m.ownership[0].replace('.ts', '.test.ts')}`],
    red: m.red ?? ['实现前测试应失败'],
    verify: 'RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e group-chat',
    done: 'Green + Verify passed',
    ...m,
  });
}

// M-5 Binary
const M5 = [
  { id: 'T-099', wave: 1, desc: 'Binary 现状快照矩阵（类型/HTTP/节点透传/DB）', ac: 'AC-045', ownership: ['docs/architecture/binary-current-state.md'], deps: ['T-098'] },
  { id: 'T-100', wave: 1, desc: 'n8n Binary 对标审查文档', ac: 'AC-045', ownership: ['docs/architecture/binary-n8n-review.md'], deps: ['T-099'] },
  { id: 'T-101', wave: 1, desc: '业界采样与方案选项（≥2 方案，无最终决选）', ac: 'AC-045', ownership: ['docs/architecture/binary-options.md'], deps: ['T-100'] },
  { id: 'T-102', wave: 2, desc: 'Binary 差距/风险与 ADR 影响清单（须人工确认项）', ac: 'AC-055', ownership: ['docs/architecture/binary-risks.md', 'docs/adr-execution-data.md（如需修订提案）'], deps: ['T-101'] },
  { id: 'T-103', wave: 2, desc: '人工方案确认门禁记录（B-6；阻塞实现）', ac: 'AC-046', ownership: ['docs/test/milestones/M-5-binary-plan-confirmation.md'], deps: ['T-102'], red: ['未确认方案时 binary 实现测试应 skip/fail'] },
  { id: 'T-104', wave: 3, desc: 'WorkflowItem.binary 类型与 BinaryMap 扩展', ac: 'AC-047', ownership: ['packages/shared/src/workflow-item.ts', 'packages/shared/src/binary-map.ts'], deps: ['T-103'] },
  { id: 'T-105', wave: 3, desc: 'BinaryBlobService + execution_blobs 存储', ac: 'AC-051', ownership: ['packages/shared/src/binary-blob-service.ts', 'packages/providers-lite/src/blob-repository.ts'], deps: ['T-103'] },
  { id: 'T-106', wave: 3, desc: 'execution 引擎 binary 透传（非丢弃）', ac: 'AC-047', ownership: ['packages/execution/src/engine/binary-pass-through.ts'], deps: ['T-104'] },
  { id: 'T-107', wave: 3, desc: 'HTTP 响应 → binary 生产者', ac: 'AC-048', ownership: ['packages/node-runner/src/executors/http-binary.ts'], deps: ['T-104', 'T-105'] },
  { id: 'T-108', wave: 3, desc: 'Webhook multipart 上传 → binary', ac: 'AC-049', ownership: ['packages/node-runner/src/executors/triggers/webhook-binary.ts', 'apps/api/src/routes/webhook-binary.test.ts'], deps: ['T-104', 'T-105'] },
  { id: 'T-109', wave: 4, desc: '表达式 $binary 读写', ac: 'AC-050', ownership: ['packages/expression/src/binary-globals.ts', 'packages/expression/src/binary-globals.test.ts'], deps: ['T-104'] },
  { id: 'T-110', wave: 4, desc: 'Set/Merge 等节点 binary 合并策略', ac: 'AC-047', ownership: ['packages/node-runner/src/executors/transform/set-binary.ts', 'packages/node-runner/src/executors/control-flow/merge-binary.ts'], deps: ['T-106'] },
  { id: 'T-111', wave: 4, desc: 'E2E Binary 上传/下载/表达式全场景', ac: 'AC-052', ownership: ['apps/web/e2e/binary-full-chain.spec.ts'], deps: ['T-107', 'T-108', 'T-109', 'T-110'] },
  { id: 'T-112', wave: 5, desc: 'matrix Binary 行 100%', ac: 'AC-053', ownership: ['docs/test/e2e-coverage-matrix.md'], deps: ['T-111'] },
  { id: 'T-113', wave: 5, desc: 'M-5-acceptance.md + spec-gap Binary done', ac: 'AC-054, AC-056, AC-070', ownership: ['docs/test/milestones/M-5-acceptance.md', 'docs/workflow/spec-gap-audit.md'], deps: ['T-111'] },
  { id: 'T-114', wave: 5, desc: 'M-5 全量 E2E 回归', ac: 'AC-056', ownership: ['docs/test/milestones/M-5-report.md'], deps: ['T-112', 'T-113'] },
];
for (const m of M5) {
  STATIC.push({
    milestone: 'M-5',
    fr: 'FR-11',
    arch: '§9 Binary',
    tests: [`${m.ownership[0].includes('.test') ? m.ownership[0] : m.ownership[0].replace('.md', '.test.mjs').replace('.ts', '.test.ts')}`],
    red: m.red ?? ['B-6 未通过前实现测试必须失败'],
    verify: 'pnpm --filter @rxwf/shared test; pnpm --filter @rxwf/web test:e2e binary',
    done: 'Green + Verify passed',
    deps: m.deps,
    ...m,
  });
}

// M-6 help docs T-115 .. T-159 (45 nodes)
let helpId = 115;
for (const n of NODES) {
  const id = `T-${helpId}`;
  STATIC.push({
    id,
    milestone: 'M-6',
    wave: 1,
    desc: `编写 docs/help/zh/nodes/${n.type}.md（≥300 字 + 示例 A/B/C）`,
    fr: 'FR-06, FR-07',
    ac: 'AC-057, AC-059',
    arch: '§3.2 帮助加载',
    deps: ['T-114'],
    red: [`help ${n.type} 字数 < 300 应失败`, '缺少用途/端口/参数/错误/示例节应失败'],
    tests: ['scripts/validate-help-doc.test.mjs'],
    ownership: [`docs/help/zh/nodes/${n.type}.md`],
    done: '帮助文满足 OQ-007/OQ-011',
    verify: `node scripts/validate-help-doc.mjs docs/help/zh/nodes/${n.type}.md`,
  });
  helpId++;
}

// M-6 registry & closure T-160 .. T-168
STATIC.push(
  { id: 'T-160', milestone: 'M-6', wave: 2, desc: 'help-registry.ts 45 nodeType 一一映射', fr: 'FR-06', ac: 'AC-058', arch: 'help-registry', deps: ['T-159'], red: ['registry 缺少 nodeType 应失败'], tests: ['apps/web/src/features/help/help-registry.test.ts'], ownership: ['apps/web/src/features/help/help-registry.ts', 'apps/web/src/features/help/help-registry.test.ts'], done: 'AC-058 green', verify: 'pnpm --filter @rxwf/web test help-registry' },
  { id: 'T-161', milestone: 'M-6', wave: 2, desc: 'HELP_NAV 与 node-type-meta 对齐', fr: 'FR-06', ac: 'AC-061', arch: 'help-nav', deps: ['T-160'], red: ['HELP_NAV 孤儿项应失败'], tests: ['apps/web/src/features/help/help-nav.test.ts'], ownership: ['apps/web/src/features/help/help-nav.ts', 'apps/web/src/features/help/help-nav.test.ts'], done: 'AC-061 green', verify: 'pnpm --filter @rxwf/web test help-nav' },
  { id: 'T-162', milestone: 'M-6', wave: 2, desc: 'NodeEditorModal 帮助按钮 buildHelpUrl 跳转', fr: 'FR-08', ac: 'AC-060', arch: 'editor help btn', deps: ['T-160'], red: ['未映射 nodeType 打开错误 url 应失败'], tests: ['apps/web/src/features/editor/NodeEditorModal.help.test.tsx'], ownership: ['apps/web/src/features/editor/NodeEditorModal.tsx', 'apps/web/src/features/editor/build-help-url.ts'], done: '单元测试 green', verify: 'pnpm --filter @rxwf/web test NodeEditorModal.help' },
  { id: 'T-163', milestone: 'M-6', wave: 3, desc: 'E2E 45 nodeType 帮助跳转全覆盖', fr: 'FR-08', ac: 'AC-060', arch: 'E2E help', deps: ['T-160', 'T-161', 'T-162'], red: ['任一 nodeType help 404'], tests: ['apps/web/e2e/help-all-nodes.spec.ts'], ownership: ['apps/web/e2e/help-all-nodes.spec.ts'], done: '45 跳转 green', verify: 'pnpm --filter @rxwf/web test:e2e help-all-nodes' },
  { id: 'T-164', milestone: 'M-6', wave: 3, desc: 'help registry 完整性单元测试（meta↔registry↔文件）', fr: 'FR-06', ac: 'AC-062', arch: 'NFR-06', deps: ['T-160'], red: ['孤儿 md 或缺失文件应失败'], tests: ['apps/web/src/features/help/help-registry completeness.test.ts'], ownership: ['apps/web/src/features/help/help-registry-completeness.test.ts'], done: 'NFR-06 green', verify: 'pnpm --filter @rxwf/web test completeness' },
  { id: 'T-165', milestone: 'M-6', wave: 4, desc: 'e2e-coverage-matrix 100% 无 skip/待补测', fr: 'FR-19', ac: 'AC-063', arch: 'matrix 终态', deps: ['T-163'], red: ['存在 uncovered 行应失败'], tests: ['scripts/validate-e2e-matrix.test.mjs'], ownership: ['docs/test/e2e-coverage-matrix.md'], done: 'AC-063 100%', verify: 'node scripts/validate-e2e-matrix.mjs --require-full' },
  { id: 'T-166', milestone: 'M-6', wave: 4, desc: 'INDEX 全 docs 登记 + lint green', fr: 'FR-04', ac: 'AC-067', arch: 'INDEX CI', deps: ['T-159', 'T-165'], red: ['lint:docs-index 失败'], tests: ['scripts/lint-docs-index.test.mjs'], ownership: ['docs/INDEX.md'], done: 'AC-067 green', verify: 'pnpm lint:docs-index' },
  { id: 'T-167', milestone: 'M-6', wave: 4, desc: 'spec-gap-audit 无 open + M-6-acceptance.md', fr: 'FR-02', ac: 'AC-068, AC-065, AC-070', arch: '最终门禁', deps: ['T-165'], red: ['open 项 > 0 应失败'], tests: ['scripts/validate-spec-gap-audit.test.mjs'], ownership: ['docs/workflow/spec-gap-audit.md', 'docs/test/milestones/M-6-acceptance.md'], done: 'AC-068/065 就绪', verify: 'node scripts/validate-spec-gap-audit.mjs --require-closed' },
  { id: 'T-168', milestone: 'M-6', wave: 5, desc: '最终测试/验证报告 + CI 双轨全量 E2E', fr: 'FR-13', ac: 'AC-064, AC-066, AC-069', arch: '最终回归', deps: ['T-166', 'T-167'], red: ['CI E2E 失败'], tests: ['apps/web/e2e/**/*.spec.ts'], ownership: ['docs/test/test-report.md', 'docs/test/milestones/M-6-report.md', 'docs/verification/verification-report.md', 'docs/verification/milestones/M-6-report.md'], done: '最终验收就绪', verify: 'Standard + Plus 全量 E2E green' },
);

mkdirSync(OUT, { recursive: true });
for (const t of STATIC) {
  writeFileSync(join(OUT, `${t.id}.md`), fmtTask(t), 'utf8');
}
console.log(`Generated ${STATIC.length} task files (T-001 .. T-${String(STATIC.length).padStart(3, '0')})`);
