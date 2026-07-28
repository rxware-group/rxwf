# 任务索引（Dev Leader）

> **状态**：已批准 — development 进行中（M-1 Wave 1）  
> **方法论**：TDD（Red → Green → Refactor → Verify）  
> **详情目录**：`docs/workflow/tasks/T-XXX.md`  
> **分支策略**：每 Milestone 独立分支（见 architecture §11）

---

## Milestone 映射表

| Milestone | 任务 ID 范围 | 任务数 | 覆盖 AC |
|-----------|--------------|--------|---------|
| M-1 | T-001～T-015 | 15 | AC-001～012, AC-070～074 |
| M-2 | T-016～T-033 | 18 | AC-013～022, AC-070～074 |
| M-3 | T-034～T-084 | 51 | AC-023～034, AC-070～074 |
| M-4 | T-085～T-098 | 14 | AC-035～044, AC-070～074 |
| M-5 | T-099～T-114 | 16 | AC-045～056, AC-070～074 |
| M-6 | T-115～T-168 | 54 | AC-057～069, AC-070～074 |

**合计**：168 tasks，覆盖 PRD **74** 条 AC（含跨 Milestone 门禁 AC-070～074）。

---

## 任务索引表

| ID | 描述 | Milestone | 依赖 | Wave | 状态 | 详情 |
|----|------|-----------|------|------|------|------|
| T-001 | 增强 docs/README.md：分类目录、每文件一行摘要、维护规则 | M-1 | - | 1 | done | [T-001.md](tasks/T-001.md) |
| T-002 | 创建 docs/INDEX.md：YAML frontmatter + 人类可读总目录骨架 | M-1 | - | 1 | done | [T-002.md](tasks/T-002.md) |
| T-003 | 运行 spec-reviewer 流程产出 v2.0 差距矩阵（纳入审计引用） | M-1 | - | 1 | done | [T-003.md](tasks/T-003.md) |
| T-004 | 初始化 docs/test/e2e-coverage-matrix.md（v2.0 全功能行 + 列定义） | M-1 | - | 1 | done | [T-004.md](tasks/T-004.md) |
| T-005 | 实现 scripts/lint-docs-index.mjs 与单元测试（未登记 md 失败） | M-1 | - | 1 | done | [T-005.md](tasks/T-005.md) |
| T-006 | 实现 scripts/e2e-compose.mjs（up/down/wait-health） | M-1 | - | 1 | done | [T-006.md](tasks/T-006.md) |
| T-007 | 各 docs 子目录 README 增加链回 INDEX.md | M-1 | T-002 | 2 | done | [T-007.md](tasks/T-007.md) |
| T-008 | 编写 docs/workflow/spec-gap-audit.md 完整差距表 | M-1 | T-003, T-004 | 2 | done | [T-008.md](tasks/T-008.md) |
| T-009 | package.json + CI 集成 pnpm lint:docs-index | M-1 | T-005 | 2 | done | [T-009.md](tasks/T-009.md) |
| T-010 | INDEX.md 补充 FR 编号与 nodeType 交叉引用入口 | M-1 | T-002, T-008 | 2 | done | [T-010.md](tasks/T-010.md) |
| T-011 | 扩展 apps/web/e2e/global-setup.ts：compose 生命周期 + auth | M-1 | T-006 | 3 | done | [T-011.md](tasks/T-011.md) |
| T-012 | 实现 global-teardown：compose down -v + 无容器泄漏检查 | M-1 | T-006 | 3 | done | [T-012.md](tasks/T-012.md) |
| T-013 | playwright.config.ts 支持 RXWF_E2E_TRACK 双轨 project | M-1 | T-006 | 3 | done | [T-013.md](tasks/T-013.md) |
| T-014 | M-1 基线 E2E：帮助路由 + 索引/文档 smoke | M-1 | T-009, T-011 | 4 | done | [T-014.md](tasks/T-014.md) |
| T-015 | 编写 docs/test/milestones/M-1-acceptance.md 人工验收用例 | M-1 | T-008, T-014 | 4 | done | [T-015.md](tasks/T-015.md) |
| T-016 | skillRun toolWrite provider 补齐至 spec AC | M-2 | - | 1 | done | [T-016.md](tasks/T-016.md) |
| T-017 | skillRun toolGrep provider 补齐至 spec AC | M-2 | - | 1 | done | [T-017.md](tasks/T-017.md) |
| T-018 | skillRun toolWebSearch provider 补齐至 spec AC | M-2 | - | 1 | done | [T-018.md](tasks/T-018.md) |
| T-019 | credential-types 类型注册表与字段 schema 落地 | M-2 | - | 1 | done | [T-019.md](tasks/T-019.md) |
| T-020 | credential-types API 路由与 apply-auth 集成 | M-2 | - | 1 | done | [T-020.md](tasks/T-020.md) |
| T-021 | switch 动态分支：workflow 图校验与保存规则 | M-2 | - | 1 | done | [T-021.md](tasks/T-021.md) |
| T-022 | switch 动态分支：执行器路由逻辑 | M-2 | - | 1 | done | [T-022.md](tasks/T-022.md) |
| T-023 | switch 动态分支：编辑器 SwitchBranchesPanel UI | M-2 | - | 1 | done | [T-023.md](tasks/T-023.md) |
| T-024 | 工作流 ACL：identity workflow-access API 路由 | M-2 | - | 1 | done | [T-024.md](tasks/T-024.md) |
| T-025 | 工作流 ACL：WorkflowCollaboratorsPanel UI | M-2 | - | 1 | done | [T-025.md](tasks/T-025.md) |
| T-026 | skillRun 执行器集成 write/grep/web_search 子工具 | M-2 | T-016, T-017, T-018 | 2 | done | [T-026.md](tasks/T-026.md) |
| T-027 | credential-types Web 设置页与节点引用 UI | M-2 | T-019, T-020 | 2 | done | [T-027.md](tasks/T-027.md) |
| T-028 | M-2 E2E：skillRun 子能力场景 | M-2 | T-026 | 2 | done | [T-028.md](tasks/T-028.md) |
| T-029 | M-2 E2E：工作流 ACL 场景 | M-2 | T-024, T-025 | 2 | done | [T-029.md](tasks/T-029.md) |
| T-030 | M-2 E2E：credential-types + switch 动态分支 | M-2 | T-021, T-022, T-023, T-027 | 2 | done | [T-030.md](tasks/T-030.md) |
| T-031 | schemaVersion:1 工作流导入回归测试（M-2 变更） | M-2 | T-026, T-030 | 3 | done | [T-031.md](tasks/T-031.md) |
| T-032 | 更新 spec-gap-audit M-2 项为 done + matrix 覆盖状态 | M-2 | T-028, T-029, T-030 | 3 | done | [T-032.md](tasks/T-032.md) |
| T-033 | M-2 帮助/INDEX 同步（参数变更项）+ M-2-acceptance.md | M-2 | T-032 | 3 | done | [T-033.md](tasks/T-033.md) |
| T-034 | 生成节点审查矩阵脚手架（45 type × 面板/校验/执行器/错误码） | M-3 | T-033 | 1 | done | [T-034.md](tasks/T-034.md) |
| T-035 | 审查并修复 nodeType `manualTrigger`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-035.md](tasks/T-035.md) |
| T-036 | 审查并修复 nodeType `webhookTrigger`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-036.md](tasks/T-036.md) |
| T-037 | 审查并修复 nodeType `scheduleTrigger`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-037.md](tasks/T-037.md) |
| T-038 | 审查并修复 nodeType `errorTrigger`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-038.md](tasks/T-038.md) |
| T-039 | 审查并修复 nodeType `subworkflowTrigger`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-039.md](tasks/T-039.md) |
| T-040 | 审查并修复 nodeType `if`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-040.md](tasks/T-040.md) |
| T-041 | 审查并修复 nodeType `switch`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-041.md](tasks/T-041.md) |
| T-042 | 审查并修复 nodeType `merge`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-042.md](tasks/T-042.md) |
| T-043 | 审查并修复 nodeType `loop`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-043.md](tasks/T-043.md) |
| T-044 | 审查并修复 nodeType `humanApproval`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-044.md](tasks/T-044.md) |
| T-045 | 审查并修复 nodeType `splitInBatches`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-045.md](tasks/T-045.md) |
| T-046 | 审查并修复 nodeType `set`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-046.md](tasks/T-046.md) |
| T-047 | 审查并修复 nodeType `json`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-047.md](tasks/T-047.md) |
| T-048 | 审查并修复 nodeType `httpRequest`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-048.md](tasks/T-048.md) |
| T-049 | 审查并修复 nodeType `wait`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-049.md](tasks/T-049.md) |
| T-050 | 审查并修复 nodeType `code`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-050.md](tasks/T-050.md) |
| T-051 | 审查并修复 nodeType `executeCommand`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-051.md](tasks/T-051.md) |
| T-052 | 审查并修复 nodeType `executeWorkflow`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 2 | done | [T-052.md](tasks/T-052.md) |
| T-053 | 审查并修复 nodeType `readWriteFile`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-053.md](tasks/T-053.md) |
| T-054 | 审查并修复 nodeType `postgres`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 3 | done | [T-054.md](tasks/T-054.md) |
| T-055 | 审查并修复 nodeType `ollama`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 3 | done | [T-055.md](tasks/T-055.md) |
| T-056 | 审查并修复 nodeType `llmStream`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-056.md](tasks/T-056.md) |
| T-057 | 审查并修复 nodeType `ragRetrieve`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-057.md](tasks/T-057.md) |
| T-058 | 审查并修复 nodeType `ragAnswer`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-058.md](tasks/T-058.md) |
| T-059 | 审查并修复 nodeType `mcpClient`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-059.md](tasks/T-059.md) |
| T-060 | 审查并修复 nodeType `workflow_run`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-060.md](tasks/T-060.md) |
| T-061 | 审查并修复 nodeType `crewSequential`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-061.md](tasks/T-061.md) |
| T-062 | 审查并修复 nodeType `crewHierarchical`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-062.md](tasks/T-062.md) |
| T-063 | 审查并修复 nodeType `crewSupervisor`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-063.md](tasks/T-063.md) |
| T-064 | 审查并修复 nodeType `groupChat`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-064.md](tasks/T-064.md) |
| T-065 | 审查并修复 nodeType `aiAgent`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-065.md](tasks/T-065.md) |
| T-066 | 审查并修复 nodeType `aiChatModel`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-066.md](tasks/T-066.md) |
| T-067 | 审查并修复 nodeType `aiMemory`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-067.md](tasks/T-067.md) |
| T-068 | 审查并修复 nodeType `aiKnowledge`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-068.md](tasks/T-068.md) |
| T-069 | 审查并修复 nodeType `aiOutputParser`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-069.md](tasks/T-069.md) |
| T-070 | 审查并修复 nodeType `toolMcp`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-070.md](tasks/T-070.md) |
| T-071 | 审查并修复 nodeType `toolHttp`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-071.md](tasks/T-071.md) |
| T-072 | 审查并修复 nodeType `toolWorkflow`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-072.md](tasks/T-072.md) |
| T-073 | 审查并修复 nodeType `toolSkill`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-073.md](tasks/T-073.md) |
| T-074 | 审查并修复 nodeType `toolSubagent`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-074.md](tasks/T-074.md) |
| T-075 | 审查并修复 nodeType `toolRead`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-075.md](tasks/T-075.md) |
| T-076 | 审查并修复 nodeType `toolWrite`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-076.md](tasks/T-076.md) |
| T-077 | 审查并修复 nodeType `toolGrep`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-077.md](tasks/T-077.md) |
| T-078 | 审查并修复 nodeType `toolShell`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-078.md](tasks/T-078.md) |
| T-079 | 审查并修复 nodeType `toolWebSearch`：面板/校验/执行器/错误码 + E2E | M-3 | T-034 | 4 | done | [T-079.md](tasks/T-079.md) |
| T-080 | 合并 node-audit-rows 至 node-audit-matrix.md（100% 结论） | M-3 | T-079 | 5 | done | [T-080.md](tasks/T-080.md) |
| T-081 | 更新 e2e-coverage-matrix 全部 nodeType 行 | M-3 | T-079 | 5 | done | [T-081.md](tasks/T-081.md) |
| T-082 | error-codes.md 与节点失败码映射补全 | M-3 | T-079 | 5 | done | [T-082.md](tasks/T-082.md) |
| T-083 | 编写 M-3-acceptance.md（45 nodeType 人工用例） | M-3 | T-080 | 5 | done | [T-083.md](tasks/T-083.md) |
| T-084 | M-3 全量 E2E 双轨回归 + spec-gap 节点项 done | M-3 | T-081, T-082, T-083 | 5 | done | [T-084.md](tasks/T-084.md) |
| T-085 | Group Chat 架构冲突评估文档（Crew/Agent 共存） | M-4 | T-084 | 1 | done | [T-085.md](tasks/T-085.md) |
| T-086 | groupChat 参数 schema 与面板校验（含 UserProxy 默认 -1） | M-4 | T-085 | 1 | done | [T-086.md](tasks/T-086.md) |
| T-087 | groupChat round-robin 执行器 native loop | M-4 | T-085 | 1 | done | [T-087.md](tasks/T-087.md) |
| T-088 | groupChat orchestrator 模式（LLM JSON 调度） | M-4 | T-085 | 1 | done | [T-088.md](tasks/T-088.md) |
| T-089 | ai-runtime runGroupChatGraph 适配层（可选路径） | M-4 | T-085 | 1 | done | [T-089.md](tasks/T-089.md) |
| T-090 | UserProxy HITL waiting + resume 路径 | M-4 | T-086, T-087 | 2 | done | [T-090.md](tasks/T-090.md) |
| T-091 | UserProxy 超时失败终止（>0 超时，默认 -1 不超时） | M-4 | T-090 | 2 | done | [T-091.md](tasks/T-091.md) |
| T-092 | Group Chat agentSteps 审计事件 | M-4 | T-087, T-088 | 2 | done | [T-092.md](tasks/T-092.md) |
| T-093 | API orchestrationResume kind=groupChat 集成 | M-4 | T-090, T-091 | 3 | done | [T-093.md](tasks/T-093.md) |
| T-094 | E2E Group Chat round-robin（Plus 轨） | M-4 | T-087, T-093 | 3 | done | [T-094.md](tasks/T-094.md) |
| T-095 | E2E Group Chat orchestrator + UserProxy | M-4 | T-088, T-090, T-093 | 3 | done | [T-095.md](tasks/T-095.md) |
| T-096 | matrix Group Chat 行 100% + spec-gap done | M-4 | T-094, T-095 | 4 | done | [T-096.md](tasks/T-096.md) |
| T-097 | M-4-acceptance.md 人工验收用例 | M-4 | T-095 | 4 | done | [T-097.md](tasks/T-097.md) |
| T-098 | M-4 全量 E2E 回归 | M-4 | T-096, T-097 | 4 | done | [T-098.md](tasks/T-098.md) |
| T-099 | Binary 现状快照矩阵（类型/HTTP/节点透传/DB） | M-5 | T-098 | 1 | done | [T-099.md](tasks/T-099.md) |
| T-100 | n8n Binary 对标审查文档 | M-5 | T-099 | 1 | done | [T-100.md](tasks/T-100.md) |
| T-101 | 业界采样与方案选项（≥2 方案，无最终决选） | M-5 | T-100 | 1 | done | [T-101.md](tasks/T-101.md) |
| T-102 | Binary 差距/风险与 ADR 影响清单（须人工确认项） | M-5 | T-101 | 2 | done | [T-102.md](tasks/T-102.md) |
| T-103 | 人工方案确认门禁记录（B-6；阻塞实现） | M-5 | T-102 | 2 | done | [T-103.md](tasks/T-103.md) |
| T-104 | WorkflowItem.binary 类型与 BinaryMap 扩展 | M-5 | T-103 | 3 | done | [T-104.md](tasks/T-104.md) |
| T-105 | BinaryBlobService + execution_blobs 存储 | M-5 | T-103 | 3 | done | [T-105.md](tasks/T-105.md) |
| T-106 | execution 引擎 binary 透传（非丢弃） | M-5 | T-104 | 3 | done | [T-106.md](tasks/T-106.md) |
| T-107 | HTTP 响应 → binary 生产者 | M-5 | T-104, T-105 | 3 | done | [T-107.md](tasks/T-107.md) |
| T-108 | Webhook multipart 上传 → binary | M-5 | T-104, T-105 | 3 | done | [T-108.md](tasks/T-108.md) |
| T-109 | 表达式 $binary 读写 | M-5 | T-104 | 4 | done | [T-109.md](tasks/T-109.md) |
| T-110 | Set/Merge 等节点 binary 合并策略 | M-5 | T-106 | 4 | done | [T-110.md](tasks/T-110.md) |
| T-111 | E2E Binary 上传/下载/表达式全场景 | M-5 | T-107, T-108, T-109, T-110 | 4 | done | [T-111.md](tasks/T-111.md) |
| T-112 | matrix Binary 行 100% | M-5 | T-111 | 5 | done | [T-112.md](tasks/T-112.md) |
| T-113 | M-5-acceptance.md + spec-gap Binary done | M-5 | T-111 | 5 | done | [T-113.md](tasks/T-113.md) |
| T-114 | M-5 全量 E2E 回归 | M-5 | T-112, T-113 | 5 | done | [T-114.md](tasks/T-114.md) |
| T-115 | 编写 docs/help/zh/nodes/manualTrigger.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-115.md](tasks/T-115.md) |
| T-116 | 编写 docs/help/zh/nodes/webhookTrigger.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-116.md](tasks/T-116.md) |
| T-117 | 编写 docs/help/zh/nodes/scheduleTrigger.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-117.md](tasks/T-117.md) |
| T-118 | 编写 docs/help/zh/nodes/errorTrigger.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-118.md](tasks/T-118.md) |
| T-119 | 编写 docs/help/zh/nodes/subworkflowTrigger.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-119.md](tasks/T-119.md) |
| T-120 | 编写 docs/help/zh/nodes/if.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-120.md](tasks/T-120.md) |
| T-121 | 编写 docs/help/zh/nodes/switch.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-121.md](tasks/T-121.md) |
| T-122 | 编写 docs/help/zh/nodes/merge.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-122.md](tasks/T-122.md) |
| T-123 | 编写 docs/help/zh/nodes/loop.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-123.md](tasks/T-123.md) |
| T-124 | 编写 docs/help/zh/nodes/humanApproval.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-124.md](tasks/T-124.md) |
| T-125 | 编写 docs/help/zh/nodes/splitInBatches.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-125.md](tasks/T-125.md) |
| T-126 | 编写 docs/help/zh/nodes/set.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-126.md](tasks/T-126.md) |
| T-127 | 编写 docs/help/zh/nodes/json.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-127.md](tasks/T-127.md) |
| T-128 | 编写 docs/help/zh/nodes/httpRequest.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-128.md](tasks/T-128.md) |
| T-129 | 编写 docs/help/zh/nodes/wait.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-129.md](tasks/T-129.md) |
| T-130 | 编写 docs/help/zh/nodes/code.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-130.md](tasks/T-130.md) |
| T-131 | 编写 docs/help/zh/nodes/executeCommand.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-131.md](tasks/T-131.md) |
| T-132 | 编写 docs/help/zh/nodes/executeWorkflow.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-132.md](tasks/T-132.md) |
| T-133 | 编写 docs/help/zh/nodes/readWriteFile.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-133.md](tasks/T-133.md) |
| T-134 | 编写 docs/help/zh/nodes/postgres.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-134.md](tasks/T-134.md) |
| T-135 | 编写 docs/help/zh/nodes/ollama.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-135.md](tasks/T-135.md) |
| T-136 | 编写 docs/help/zh/nodes/llmStream.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-136.md](tasks/T-136.md) |
| T-137 | 编写 docs/help/zh/nodes/ragRetrieve.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-137.md](tasks/T-137.md) |
| T-138 | 编写 docs/help/zh/nodes/ragAnswer.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-138.md](tasks/T-138.md) |
| T-139 | 编写 docs/help/zh/nodes/mcpClient.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-139.md](tasks/T-139.md) |
| T-140 | 编写 docs/help/zh/nodes/workflow_run.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-140.md](tasks/T-140.md) |
| T-141 | 编写 docs/help/zh/nodes/crewSequential.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-141.md](tasks/T-141.md) |
| T-142 | 编写 docs/help/zh/nodes/crewHierarchical.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-142.md](tasks/T-142.md) |
| T-143 | 编写 docs/help/zh/nodes/crewSupervisor.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-143.md](tasks/T-143.md) |
| T-144 | 编写 docs/help/zh/nodes/groupChat.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-144.md](tasks/T-144.md) |
| T-145 | 编写 docs/help/zh/nodes/aiAgent.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-145.md](tasks/T-145.md) |
| T-146 | 编写 docs/help/zh/nodes/aiChatModel.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-146.md](tasks/T-146.md) |
| T-147 | 编写 docs/help/zh/nodes/aiMemory.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-147.md](tasks/T-147.md) |
| T-148 | 编写 docs/help/zh/nodes/aiKnowledge.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-148.md](tasks/T-148.md) |
| T-149 | 编写 docs/help/zh/nodes/aiOutputParser.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-149.md](tasks/T-149.md) |
| T-150 | 编写 docs/help/zh/nodes/toolMcp.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-150.md](tasks/T-150.md) |
| T-151 | 编写 docs/help/zh/nodes/toolHttp.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-151.md](tasks/T-151.md) |
| T-152 | 编写 docs/help/zh/nodes/toolWorkflow.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-152.md](tasks/T-152.md) |
| T-153 | 编写 docs/help/zh/nodes/toolSkill.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-153.md](tasks/T-153.md) |
| T-154 | 编写 docs/help/zh/nodes/toolSubagent.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-154.md](tasks/T-154.md) |
| T-155 | 编写 docs/help/zh/nodes/toolRead.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-155.md](tasks/T-155.md) |
| T-156 | 编写 docs/help/zh/nodes/toolWrite.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-156.md](tasks/T-156.md) |
| T-157 | 编写 docs/help/zh/nodes/toolGrep.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-157.md](tasks/T-157.md) |
| T-158 | 编写 docs/help/zh/nodes/toolShell.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-158.md](tasks/T-158.md) |
| T-159 | 编写 docs/help/zh/nodes/toolWebSearch.md（≥300 字 + 示例 A/B/C） | M-6 | T-114 | 1 | done | [T-159.md](tasks/T-159.md) |
| T-160 | help-registry.ts 45 nodeType 一一映射 | M-6 | T-159 | 2 | done | [T-160.md](tasks/T-160.md) |
| T-161 | HELP_NAV 与 node-type-meta 对齐 | M-6 | T-160 | 2 | done | [T-161.md](tasks/T-161.md) |
| T-162 | NodeEditorModal 帮助按钮 buildHelpUrl 跳转 | M-6 | T-160 | 2 | done | [T-162.md](tasks/T-162.md) |
| T-163 | E2E 45 nodeType 帮助跳转全覆盖 | M-6 | T-160, T-161, T-162 | 3 | done | [T-163.md](tasks/T-163.md) |
| T-164 | help registry 完整性单元测试（meta↔registry↔文件） | M-6 | T-160 | 3 | done | [T-164.md](tasks/T-164.md) |
| T-165 | e2e-coverage-matrix 100% 无 skip/待补测 | M-6 | T-163 | 4 | done | [T-165.md](tasks/T-165.md) |
| T-166 | INDEX 全 docs 登记 + lint green | M-6 | T-159, T-165 | 4 | done | [T-166.md](tasks/T-166.md) |
| T-167 | spec-gap-audit 无 open + M-6-acceptance.md | M-6 | T-165 | 4 | done | [T-167.md](tasks/T-167.md) |
| T-168 | 最终测试/验证报告 + CI 双轨全量 E2E | M-6 | T-166, T-167 | 5 | done | [T-168.md](tasks/T-168.md) |

---

## 并行波次表（按 Milestone 分段）

### M-1

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-001, T-002, T-003, T-004, T-005, T-006 | 是（文件所有权不重叠） | 文档+脚本+compose 6 路并行 |
| W2 | T-007, T-008, T-009, T-010 | 是（文件所有权不重叠） |  |
| W3 | T-011, T-012, T-013 | 是（文件所有权不重叠） |  |
| W4 | T-014, T-015 | 是（文件所有权不重叠） |  |

### M-2

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-016, T-017, T-018, T-019, T-020, T-021, T-022, T-023, T-024, T-025 | 是（文件所有权不重叠） | 半实现项 10 路并行 |
| W2 | T-026, T-027, T-028, T-029, T-030 | 是（文件所有权不重叠） |  |
| W3 | T-031, T-032, T-033 | 是（文件所有权不重叠） |  |

### M-3

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-034 | 是（文件所有权不重叠） |  |
| W2 | T-035, T-036, T-037, T-038, T-040, T-041, T-042, T-043, T-044, T-046, T-047, T-048, T-049, T-050, T-051, T-052 | 是（文件所有权不重叠） | Lite 轨 16 nodeType 并行 |
| W3 | T-054, T-055 | 是（文件所有权不重叠） |  |
| W4 | T-039, T-045, T-053, T-056, T-057, T-058, T-059, T-060, T-061, T-062, T-063, T-064, T-065, T-066, T-067, T-068, T-069, T-070, T-071, T-072, T-073, T-074, T-075, T-076, T-077, T-078, T-079 | 是（文件所有权不重叠） | Plus 轨 27 nodeType 并行 |
| W5 | T-080, T-081, T-082, T-083, T-084 | 是（文件所有权不重叠） |  |

### M-4

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-085, T-086, T-087, T-088, T-089 | 是（文件所有权不重叠） |  |
| W2 | T-090, T-091, T-092 | 是（文件所有权不重叠） |  |
| W3 | T-093, T-094, T-095 | 是（文件所有权不重叠） |  |
| W4 | T-096, T-097, T-098 | 是（文件所有权不重叠） |  |

### M-5

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-099, T-100, T-101 | 是（文件所有权不重叠） |  |
| W2 | T-102, T-103 | 是（文件所有权不重叠） |  |
| W3 | T-104, T-105, T-106, T-107, T-108 | 是（文件所有权不重叠） |  |
| W4 | T-109, T-110, T-111 | 是（文件所有权不重叠） |  |
| W5 | T-112, T-113, T-114 | 是（文件所有权不重叠） |  |

### M-6

| Wave | 任务 ID | 并行安全 | 说明 |
|------|---------|----------|------|
| W1 | T-115, T-116, T-117, T-118, T-119, T-120, T-121, T-122, T-123, T-124, T-125, T-126, T-127, T-128, T-129, T-130, T-131, T-132, T-133, T-134, T-135, T-136, T-137, T-138, T-139, T-140, T-141, T-142, T-143, T-144, T-145, T-146, T-147, T-148, T-149, T-150, T-151, T-152, T-153, T-154, T-155, T-156, T-157, T-158, T-159 | 是（文件所有权不重叠） | 45 独立 help 文并行 |
| W2 | T-160, T-161, T-162 | 是（文件所有权不重叠） |  |
| W3 | T-163, T-164 | 是（文件所有权不重叠） |  |
| W4 | T-165, T-166, T-167 | 是（文件所有权不重叠） |  |
| W5 | T-168 | 是（文件所有权不重叠） |  |

---

## 并行度分析

| 指标 | 值 |
|------|-----|
| **总 task 数** | 168 |
| M-1 task 数 | 15 |
| M-2 task 数 | 18 |
| M-3 task 数 | 51 |
| M-4 task 数 | 14 |
| M-5 task 数 | 16 |
| M-6 task 数 | 54 |
| **最大 wave 宽度** | **45**（M-6 W1：45 篇 help 并行） |
| **Wave 总数** | 26（各 Milestone 局部 Wave 之和） |
| **全局 Wave 数（state.json）** | 26 |
| 平均 task 覆盖 AC 数 | ~1.2（细粒度拆分；门禁 AC 由 Milestone 收口 task 覆盖） |

### 拆分理由摘要

1. **M-1**：文档索引、差距审计、E2E 矩阵、索引 CI、compose harness 拆为 15 个单一职责 task；Wave 1 即 6 路并行（含 e2e-compose）。
2. **M-2**：skillRun 三子工具、ACL、credential-types、switch（校验/执行/UI）各独立 task；Wave 1 宽度 10。
3. **M-3**：1 矩阵脚手架 + **45 nodeType 各 1 task**（独占 executor/E2E/audit-row）+ 5 收口 task；Lite/Standard/Plus 分 Wave 2/3/4 最大化并行。
4. **M-4**：Group Chat 按 round-robin / orchestrator / UserProxy / HITL / E2E 垂直切片 14 task。
5. **M-5**：Binary 审查门禁（B-1～B-6）与实现分离；方案确认（T-103）阻塞 T-104+。
6. **M-6**：**45 help 文各 1 task**（Wave 1 宽度 45）+ registry/E2E/矩阵 100% 收口。

---

## 依赖图 / 执行顺序

```
M-1 (W1→W4) ──► M-2 (W1→W3) ──► M-3 (W1→W5) ──► M-4 ──► M-5 ──► M-6
                     │                │
                     │                └── 45×(审查+E2E) 可 Wave 内并行
                     └── 半实现 10 路 Wave1 并行
```

**Milestone 顺序**：M-1 全部完成 → M-2 → … → M-6（编排器 enforce）。  
**M-5 特殊门禁**：T-103 人工方案确认前，T-104～T-111 仅可写失败测试，不得合入实现。

---

## TDD / PRD / 架构 / Milestone 覆盖检查

| 检查项 | 状态 |
|--------|------|
| PRD 74 AC 均有 ≥1 task 映射 | ✅ |
| 架构模块（§2～§10）落点明确 | ✅ |
| 每 task 含 TDD Red + 文件所有权 | ✅ |
| M-3 45 nodeType 各 ≥1 E2E task | ✅（T-035～T-079） |
| M-6 45 help 各独立 task | ✅（T-115～T-159） |
| 跨 Milestone AC-070～074 | ✅ 各 M 收口 task（acceptance + E2E 回归） |
| TDD 方法论 | ✅ 全 task `todo`，developer Red 先行 |

---

## 风险与阻塞项

| 风险 | 影响 | 缓解 task |
|------|------|-----------|
| M-5 方案未确认 | 阻塞 Binary 实现 | T-103 人工门禁 |
| M-4 与 Crew 架构冲突 | 可能暂停 FR-16 | T-085 冲突评估 |
| agent-satellite-tools.ts 多 node 共享 | M-3 Wave4 卫星节点需协调 | 各 task 仅改对应 satellite 注册分支；冲突则串行 |
| Docker CI 不稳定 | E2E 假失败 | T-006/T-011/T-012 compose harness |
| 帮助 45 篇并行 | 仅 docs 路径，Wave1 安全 | T-115～T-159 独占 `docs/help/zh/nodes/<type>.md` |

---

**下一步**：用户 `批准任务清单` → 编排器 `gates.tasks.status = approved` → 从 M-1 分支 `milestone/m-1-docs-index` 启动 development。
