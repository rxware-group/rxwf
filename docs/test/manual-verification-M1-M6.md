# M-1～M-6 人工验证功能清单

> **分支**：`master`（M-6 已合入）  
> **用途**：按 Milestone 逐项人工验证；详细步骤见各 `M-x-acceptance.md`  
> **环境**：Lite（单进程 SQLite）/ Standard（Postgres+Redis）/ Plus（+ Ollama/CrewAI 等）  
> **更新**：2026-06-18

---

## 验证前准备

| 项 | 命令 / 说明 |
|---|---|
| 启动 Lite | `pnpm dev`（Web + API） |
| 启动 Standard | `docker compose -f deploy/docker-compose.standard.yml up -d` |
| 启动 Plus | Standard + Plus compose profile |
| 索引门禁 | `pnpm lint:docs-index` |
| 差距审计 | `node scripts/validate-spec-gap-audit.mjs --require-closed` |
| E2E 矩阵 | `node scripts/validate-e2e-matrix.mjs --require-full` |
| Lite 全量 E2E | `cd apps/web && $env:RXWF_E2E_TRACK='lite'; npx playwright test e2e/**/*.spec.ts --project=lite-chromium --retries=1 --workers=1` |

**完整用例文档**：

| Milestone | 验收清单 |
|-----------|----------|
| M-1 | [M-1-acceptance.md](milestones/M-1-acceptance.md) |
| M-2 | [M-2-acceptance.md](milestones/M-2-acceptance.md) |
| M-3 | [M-3-acceptance.md](milestones/M-3-acceptance.md)（46 nodeType 逐条） |
| M-4 | [M-4-acceptance.md](milestones/M-4-acceptance.md) |
| M-5 | [M-5-acceptance.md](milestones/M-5-acceptance.md) |
| M-6 | [M-6-acceptance.md](milestones/M-6-acceptance.md) |

---

## M-1：文档索引与 v2.0 差距审计基线

**交付本质**：文档体系 + E2E 覆盖矩阵 + 差距表，为后续 Milestone 定边界。

### 可验证功能

| # | 功能 | 怎么验 |
|---|------|--------|
| 1 | **文档总索引** `docs/INDEX.md` | 打开 INDEX，frontmatter 可解析；人类目录链接可点击到达 |
| 2 | **文档分类 README** | `docs/README.md` 维护规则 ≥5 条；摘要与真实文档一致 |
| 3 | **子目录 README 链回** | `docs/test/README.md` 等能链回 INDEX |
| 4 | **INDEX CI 门禁** | 故意漏登记一个 `.md` → `pnpm lint:docs-index` 应失败且信息可读 |
| 5 | **差距审计表** | `docs/workflow/spec-gap-audit.md` 覆盖 v2.0 能力，每行有 spec/现状/M/E2E 列 |
| 6 | **E2E 覆盖矩阵** | `docs/test/e2e-coverage-matrix.md` 含 nodeType + platform 行 |
| 7 | **帮助路由基线** | 浏览器 `/help`、`/help/nodes/loop`、`/help/expressions` 正常渲染 |
| 8 | **INDEX smoke E2E** | `docs-index-smoke.spec.ts` 对应路径可访问 |

---

## M-2：v2.0 半实现项补齐

**交付本质**：4 块此前「半实现」能力的完整落地。

### 可验证功能

| # | 功能 | 怎么验 | 轨 |
|---|------|--------|-----|
| 1 | **skillRun 显式 Tool 卫星** | 画布：`skillRun` + `aiChatModel` + `toolWrite`/`toolGrep`/`toolWebSearch`（ai_tool 连线）；面板有 skillSource、timeoutMs；帮助 `skillRun.md` 说明三类卫星 | Plus |
| 2 | **工作流 ACL** | 协作者面板：Owner/Editor/Viewer；Editor 可改不可删；Viewer 只读；API 权限与 UI 一致 | Standard |
| 3 | **Credential 类型注册表** | 设置 → 凭据：类型下拉含 HTTP/Ollama/Postgres 等；创建/编辑/删除凭据 | Standard |
| 4 | **Switch 动态分支** | Switch 节点 → `SwitchBranchesPanel` 可增删动态规则；多分支路由「首匹配」；帮助与面板字段一致 | Lite |
| 5 | **schemaVersion:1 兼容** | 导入旧版 JSON 工作流不报错；负向导入有明确错误 | Lite |
| 6 | **帮助/INDEX 同步** | M-2 涉及节点帮助与 INDEX 已登记 | Lite |

**E2E 参考**：`skill-run-tools.spec.ts`、`workflow-acl.spec.ts`、`credential-types.spec.ts`、`switch-dynamic.spec.ts`

---

## M-3：全节点审查与修复（46 nodeType）

**交付本质**：每个可执行节点「面板 → 校验 → 执行器 → 错误码」全链路可诊断；Docker 真实依赖验收。

### Lite 轨（无外部依赖，优先验）

| 类别 | nodeType 示例 | 验证要点 |
|------|---------------|----------|
| 触发 | manualTrigger, webhookTrigger, scheduleTrigger, errorTrigger, subworkflowTrigger | 面板字段、保存校验、debug 执行 |
| 逻辑 | if, switch, merge, loop, humanApproval, splitInBatches | 分支/合并/循环行为；Loop 的 loop/done 双出口 |
| 数据 | set, json, code | 字段映射、JSON 转换、Code 沙箱 |
| 动作 | httpRequest, wait, executeCommand, readWriteFile | HTTP 请求、等待、命令执行、读写文件 |
| 子流程 | executeWorkflow | 子工作流调用 |

### Standard 轨（Postgres/Redis）

| nodeType | 验证要点 |
|----------|----------|
| postgres | compose 下 SELECT/INSERT；不可达时有明确错误 |
| executeCommand | 在 Standard 环境可执行 shell 命令 |

### Plus 轨（Ollama / Agent / Crew / MCP）

| 类别 | nodeType 示例 | 验证要点 |
|------|---------------|----------|
| LLM | llm, aiChatModel | LLM 服务可达时可对话输出 |
| Agent | aiAgent, aiMemory, aiKnowledge, aiOutputParser | 卫星端口接线（ChatModel/Memory/Knowledge/Parser） |
| Crew | crewSequential, crewHierarchical, crewSupervisor | 成员接线、Supervisor 调度 |
| RAG | ragRetrieve, ragAnswer | KB 索引依赖 Docker |
| Tool 卫星 | toolHttp, toolMcp, toolRead, toolWrite, toolGrep, toolShell, toolWebSearch, toolSkill, toolSubagent, toolWorkflow | 各 Tool 面板与 aiAgent/skillRun 接线 |
| MCP | mcpClient | MCP 客户端连接 |
| 其他 | groupChat, workflow_run | 见 M-4 |

### 审查记录对照

每个 nodeType 有审查行：`docs/test/node-audit-rows/<type>.md`  
抽检：`panel / validation / executor` 均为 `ok`，失败时错误码（如 E3010）用户可读。

**E2E 参考**：`apps/web/e2e/nodes/*.spec.ts`（46 个 nodeType 各 ≥1 条）

---

## M-4：Group Chat MVP

**交付本质**：多 Agent 群聊三种模式 + UserProxy 人工插话。

### 可验证功能

| # | 功能 | 怎么验 | 轨 |
|---|------|--------|-----|
| 1 | **Round-robin 轮询** | `groupChat` + ≥2 `aiAgent`（group_member 连线）+ 各成员 aiChatModel；`speakerSelection=roundRobin`；执行后 transcript 可读 | Plus |
| 2 | **Orchestrator 调度** | `speakerSelection=orchestrator` + orchestrator Agent 接线；调度顺序符合配置 | Plus |
| 3 | **UserProxy 人工插话** | 执行中 waiting → 用户 supplement → resume 继续；超时默认行为合理 | Plus |
| 4 | **参数校验** | 成员缺 ChatModel → E1012；非法成员配置 → E1048/E1049 可读 | Plus |
| 5 | **架构冲突评估** | `docs/architecture/group-chat-conflict-review.md` gate cleared | 文档 |
| 6 | **模板工作流** | 导入 `fixtures/templates/agent-group-chat-round-robin.json` 可运行 | Plus |

**E2E 参考**：`group-chat-round-robin.spec.ts`、`group-chat-orchestrator-user-proxy.spec.ts`、`nodes/groupChat.spec.ts`

---

## M-5：Binary 全链路（OPT-01）

**交付本质**：工作流中二进制数据的产生、传递、表达式读写、存储全链路。

### 可验证功能

| # | 功能 | 怎么验 | 轨 |
|---|------|--------|-----|
| 1 | **HTTP 响应 → binary** | httpRequest 设 `responseBinaryMode`；响应体进 `$binary` | Standard |
| 2 | **Webhook multipart 上传** | webhookTrigger 收 multipart → binary item | Standard |
| 3 | **表达式 `$binary`** | Set/Code 节点读写 `$binary`；IF 节点按 binary 分支 | Standard |
| 4 | **节点间透传** | HTTP → Set → Merge 链路 binary 不丢失 | Standard |
| 5 | **Merge combine 策略** | combineAll / combineByKey 保留 binary | Lite |
| 6 | **Blob 存储** | Lite SQLite blob；256 KiB inline / 32 MiB 上限边界 | Lite |
| 7 | **调试 UI** | 执行日志/调试面板可见 binary 摘要（非裸 blob） | Lite |
| 8 | **B-6 方案确认** | `M-5-binary-plan-confirmation.md` humanGate=approved | 文档 |

**E2E 参考**：`binary-full-chain.spec.ts`（Standard 轨 13 场景；httpbin 503 可能 flaky）

**已知 partial**：Standard profile blob（GAP-02）仍为 planned，Lite blob 已落地。

---

## M-6：帮助全覆盖与最终回归

**交付本质**：45 篇节点帮助 + registry/nav + 编辑器跳转 + matrix/INDEX 100%。

### 可验证功能

| # | 功能 | 怎么验 |
|---|------|--------|
| 1 | **45 篇帮助文档** | `/help/nodes/<type>` 均可打开；含用途/端口/参数/常见错误/示例 A/B/C |
| 2 | **help-registry 映射** | `help-doc-node-types.ts` 45 项 ↔ `docs/help/zh/nodes/*.md` ↔ 路由无 404 |
| 3 | **编辑器帮助按钮** | 节点编辑器「?」→ 新 Tab 打开正确 `/help/nodes/<type>` |
| 4 | **侧栏 HELP_NAV** | 帮助中心左侧 45 项标签与画布 palette（NODE_TYPE_META）一致 |
| 5 | **帮助质量脚本** | `node scripts/validate-help-doc.test.mjs` + 45 文件批量 validate |
| 6 | **E2E 帮助专项** | `help-all-nodes.spec.ts`（45 路由）、`platform-capabilities.spec.ts`（E2E-P-008 等） |
| 7 | **INDEX 全登记** | `pnpm lint:docs-index` → 395 docs OK |
| 8 | **matrix 100%** | `node scripts/validate-e2e-matrix.mjs --require-full` → 65 rows covered |
| 9 | **Lite 全量回归** | 57 spec、247/248 pass（postgres lite infra 1 fail 已知） |

**抽检 5 篇**：manualTrigger、httpRequest、aiAgent、toolGrep、groupChat

---

## 推荐验证顺序（约 2～4 小时）

1. **10 min** — M-1：INDEX、matrix、gap 表、/help 基线路由
2. **20 min** — M-6：5 篇帮助抽检 + 编辑器帮助按钮 + 侧栏 nav
3. **30 min** — M-2：Switch 动态分支、ACL、credential、skillRun 接线
4. **60 min** — M-3：Lite 核心 15 节点（触发/逻辑/HTTP/Set/Code/Loop）
5. **30 min** — M-3：Standard postgres + Plus aiAgent/llm 抽样
6. **30 min** — M-4：Group Chat round-robin + UserProxy
7. **30 min** — M-5：Binary HTTP 下载 + Webhook upload + `$binary` Set
8. **15 min** — 四门禁脚本 + Lite E2E 抽样

---

## 已知限制（不阻断 milestone，验证时留意）

| 项 | 说明 |
|---|---|
| **Loop 回连 Loop（partial）** | 循环体连回 Loop main 时，**单节点 debug** 曾栈溢出；已在 `planPartialExecution.isNeeded` 加环检测修复。全量执行不受影响 |
| **Standard/Plus E2E** | 需 Docker Desktop；本机 daemon 未就绪时 AC-064 标 blocked |
| **httpbin.org** | HTTP Binary E2E 可能 503 flaky |
| **skillRun.md** | M-2 遗留短文，不在 45 registry（OQ-007 边界） |
| **postgres @any on Lite** | 无 Postgres 依赖，E2E 预期 fail（infrastructure） |
| **GAP-02 Standard blob** | M-5 遗留 planned |
| **gates.finalAcceptance** | M-1～M-6 milestone 已 accepted；项目最终放行仍待 `最终验收` |

---

## 快速脚本验收包（约 5 min）

```powershell
pnpm lint:docs-index
node scripts/validate-spec-gap-audit.mjs --require-closed
node scripts/validate-e2e-matrix.mjs --require-full
node scripts/validate-help-doc.test.mjs
pnpm --filter @rxwf/web test help-registry help-nav completeness
pnpm --filter @rxwf/workflow exec vitest run schema-compat
```

全部 exit 0 即文档/registry/matrix/帮助/schema 门禁通过；**业务功能**仍须按上表在 UI 中逐项点验。

---

## 验证签字（可选）

| Milestone | 验证人 | 日期 | 结论 | 备注 |
|-----------|--------|------|------|------|
| M-1 | | | ☐ 通过 ☐ 失败 | |
| M-2 | | | ☐ 通过 ☐ 失败 | |
| M-3 | | | ☐ 通过 ☐ 失败 | |
| M-4 | | | ☐ 通过 ☐ 失败 | |
| M-5 | | | ☐ 通过 ☐ 失败 | |
| M-6 | | | ☐ 通过 ☐ 失败 | |
| **汇总** | | | ☐ 可发布 ☐ 阻塞 | |
