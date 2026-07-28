---
milestone: M-4
version: 1
updated: 2026-06-20
ac_coverage:
  - AC-035
  - AC-036
  - AC-037
  - AC-038
  - AC-039
  - AC-040
  - AC-041
  - AC-042
  - AC-043
  - AC-044
  - AC-070
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
plus_track_required: true
---

# M-4 人工验收用例

> **Milestone**：M-4 — Group Chat MVP（round-robin / orchestrator / UserProxy）  
> **追溯**：FR-10 / AC-035～044, AC-070 / PRD §5.4、§9  
> **E2E 互补**（OQ-009）：本清单侧重 E2E **无法覆盖** 的 **UX**、**文档可读性**、**本地环境验证** 与 **边界场景**；与 `apps/web/e2e/nodes/groupChat.spec.ts`、`group-chat-round-robin.spec.ts`、`group-chat-orchestrator-user-proxy.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-4`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix 行 | E2E 互补说明 |
|----|--------|----------|-----------|--------------|
| AC-035 | groupChat round-robin 可执行 | M4-MAN-001, M4-MAN-002 | E2E-N-groupChat, group-chat-round-robin.spec.ts | E2E 验执行；人工验 **成员接线 UX、transcript 可读性** |
| AC-036 | groupChat orchestrator 可执行 | M4-MAN-003 | E2E-N-groupChat, group-chat-orchestrator-user-proxy.spec.ts | E2E 验调度；人工验 **orchestrator Agent 接线与面板** |
| AC-037 | UserProxy 人工插话（Plus 轨） | M4-MAN-004, M4-MAN-005 | group-chat-orchestrator-user-proxy.spec.ts | E2E 验 resume；人工验 **waiting UI、supplement 边界、超时默认** |
| AC-038 | 架构冲突已评估/确认 | M4-MAN-006 | — | 人工 **冲突评估文档与 gate 可读性** |
| AC-039 | Group Chat 全场景 E2E green | M4-MAN-007 | E2E-N-groupChat | E2E 验 green；人工验 **Plus compose 本地可复现** |
| AC-040 | matrix Group Chat 行 100% 覆盖 | M4-MAN-008 | E2E-N-groupChat | 人工 **matrix status/spec 列对照** |
| AC-041 | 本验收清单全通过 | M4-MAN-009 | — | meta 自检 |
| AC-042 | 全量 E2E green | M4-MAN-007 | — | E2E 验 green；人工验 **双轨无回归** |
| AC-043 | 参数面板校验与错误可诊断 | M4-MAN-001, M4-MAN-003, M4-MAN-010 | E2E-N-groupChat | E2E 验 E1048；人工验 **E1049/E1012 消息可读性** |
| AC-044 | spec-gap Group Chat 项 done | M4-MAN-011 | E2E-N-groupChat | 人工 **GAP-011 状态抽检** |
| AC-070 | Milestone 人工用例全通过 | M4-MAN-009 | — | 放行门禁 |

---

## 用例清单

### M4-MAN-001：groupChat round-robin 成员接线与参数面板 UX

**追溯 AC**: AC-035, AC-043

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-035, AC-043 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat, aiAgent, aiChatModel |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-4-group-chat` 分支
- `docs/test/node-audit-rows/groupChat.md` 审查结论 status=ok
- Plus compose profile 可启动（Ollama 等按需要）
- Web 编辑器可访问

**步骤**

1. 打开 `docs/test/node-audit-rows/groupChat.md`，确认 panel/validation/executor 均为 ok。
2. 编辑器导入 `fixtures/templates/agent-group-chat-round-robin.json`，或手动添加 **groupChat** + 至少 2 个 **aiAgent**（`group_member` 连线）+ 各成员 **aiChatModel**。
3. 打开 groupChat 参数面板：确认 `speakerSelection=roundRobin`、`maxRounds`、`terminationKeywords`、`returnTranscript` 等字段标签可读。
4. 对照审查记录，确认 **group_member** 端口名称与画布连线 UX 清晰（非 crew_member 混淆）。
5. 保存工作流，确认无 E1012（成员缺 Chat Model）静默通过。

**预期结果**

- round-robin 模板/手动接线与审查矩阵一致。
- 面板字段命名与 `node-param-schemas` 一致，placeholder 可读。
- 缺 Chat Model 时保存期有明确校验提示。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-002：round-robin 执行 transcript 与 agentSteps 可读性

**追溯 AC**: AC-035

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-035 |
| **matrix 行** | E2E-N-groupChat, group-chat-round-robin.spec.ts |
| **nodeType** | groupChat |
| **所属轨** | Plus |

**前置条件**

- Plus compose 已启动；Ollama 可达（或 mock AI 环境可用）
- round-robin 工作流已配置（≥2 成员，`maxRounds` 设为 2～3 便于观察）

**步骤**

1. 对 groupChat 节点执行 **debug-node** 或触发工作流执行。
2. 执行成功后，在运行详情/输出面板查看 **transcript**（或 `returnTranscriptMarkdown`）。
3. 展开 **metadata.agentSteps**，确认含 `groupChatTurn` 步骤，每步有 author/round 信息。
4. 人工阅读 transcript：发言顺序符合 round-robin 轮转，非乱序或重复同一发言者整轮霸占。
5. 对照 `docs/error-codes.md`，若失败确认错误码（如 E3001 AI runtime 未配置）用户可读。

**预期结果**

- 成功路径 transcript 结构清晰，可按轮次追踪发言。
- agentSteps 与 design spec 命名空间一致（`groupChatTurn`）。
- 失败时错误消息非裸 stack，可映射文档。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-003：orchestrator 模式面板与 orchestrator Agent 接线 UX

**追溯 AC**: AC-036, AC-043

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-036, AC-043 |
| **matrix 行** | E2E-N-groupChat, group-chat-orchestrator-user-proxy.spec.ts |
| **nodeType** | groupChat, aiAgent |
| **所属轨** | Plus |

**前置条件**

- 仓库含 `fixtures/templates/agent-group-chat-orchestrator.json`
- Plus compose 可启动

**步骤**

1. 导入 orchestrator 模板，或手动：`speakerSelection=orchestrator`，连接 **group_orchestrator** 端口的 aiAgent + Chat Model。
2. 打开参数面板，确认 `orchestratorProvider`、`orchestratorModel`（或等价字段）与帮助/审查记录一致。
3. 断开 orchestrator Agent 或移除其 Chat Model，保存/调试，确认 **E1049** 或等价校验消息可读。
4. 恢复合法配置后保存，确认 **group_member** 与 **group_orchestrator** 端口在画布上视觉可区分。

**预期结果**

- orchestrator 模式参数与接线 UX 符合 design spec。
- 缺 orchestrator 配置时边界错误 E1049 用户可读。
- 与 round-robin 模式切换后字段联动正确（无残留无效参数）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-004：UserProxy 暂停/resume 与 supplement UX

**追溯 AC**: AC-037

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-037 |
| **matrix 行** | group-chat-orchestrator-user-proxy.spec.ts |
| **nodeType** | groupChat |
| **所属轨** | Plus |

**前置条件**

- orchestrator + UserProxy 工作流：`userProxyEnabled=true`，`userProxyEveryNRounds` 设为 2（或模板默认）
- Plus 轨 API/Web 可访问；Ollama 可达或 mock 环境

**步骤**

1. 执行工作流至 groupChat 进入 **waiting**（UserProxy 轮次）。
2. 在 UI 或 API 确认 waiting 状态可见：含 checkpoint / 待人工输入提示（非静默挂起）。
3. 通过 HITL resume 提交用户 supplement（非空文本），确认执行继续并完成。
4. 查看最终 transcript，确认含 **User** 角色消息与 UserProxy 轮次对应。
5. 尝试空 supplement resume（若 UI 暴露），确认 **E3014** 或等价错误可读（边界，非 E2E 主路径）。

**预期结果**

- UserProxy waiting/resume 全链路 UX 可理解、可完成。
- transcript 含用户插话内容；agentSteps 含 `groupChatUserProxy`（若已接线审计）。
- 空 supplement 有明确拒绝，不静默继续。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-005：UserProxy 超时配置边界（OQ-010 默认 -1）

**追溯 AC**: AC-037, AC-043

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-037, AC-043 |
| **matrix 行** | — |
| **nodeType** | groupChat |
| **所属轨** | Plus |

**前置条件**

- 了解 PRD OQ-010 决选：默认 `userProxyTimeoutMs=-1`（不超时）；正数超时触发失败终止 E1048
- groupChat 参数面板可编辑 UserProxy 超时字段

**步骤**

1. 打开 groupChat 参数面板，确认 **UserProxy 超时** 默认值为 **-1**（或不超时），字段说明可读。
2. 新建/编辑工作流：启用 UserProxy，保持默认 -1，确认保存无异常。
3. （可选边界）将超时设为较小正数（如 1000ms），触发 waiting 且不 resume，观察 sweeper 后执行 **failed** 且含 **E1048** 超时语义。
4. 对照 `docs/error-codes.md` 与 `docs/test/node-audit-rows/groupChat.md` 错误码表，确认 E1048 描述与 OQ-010 一致（失败终止，非静默跳过）。

**预期结果**

- 默认不超时（-1）符合 OQ-010 决选。
- 正数超时触发失败终止 + 审计，非自动空回复继续。
- 面板/help 边界文案与 PRD 一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-006：Group Chat 架构冲突评估文档可读性

**追溯 AC**: AC-038

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-038 |
| **matrix 行** | — |
| **nodeType** | groupChat, crewSequential |
| **所属轨** | Lite-only |

**前置条件**

- `docs/architecture/group-chat-conflict-review.md` 已入库（T-085）

**步骤**

1. 打开冲突评估文档，确认 frontmatter `m4ImplementationGate: cleared` 与 `status: approved`。
2. 阅读 §3 冲突对照表，确认 GC-01～GC-09 均有结论（无 open 未确认项阻塞 M-4）。
3. 运行 `node docs/architecture/group-chat-conflict-review.test.mjs`，确认 exit 0。
4. 人工抽检：同一画布可同时存在 Crew 节点与 groupChat 节点，端口命名不冲突（`crew_member` vs `group_member`）。

**预期结果**

- 架构评估文档完整可读，gate 已 cleared。
- 自动化校验脚本 green。
- Crew/Group Chat 共存无未确认架构冲突。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-007：Plus compose 环境与 Group Chat E2E 本地复现

**追溯 AC**: AC-039, AC-042

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-039, AC-042 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat |
| **所属轨** | Plus |

**前置条件**

- Docker 可用；Plus compose profile 可 up
- 本地可运行 `RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e group-chat`

**步骤**

1. 启动 Plus compose（Ollama/MCP/Runner 等按项目文档）。
2. 运行 `RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e group-chat`（或等价命令覆盖 round-robin + orchestrator UserProxy spec）。
3. 确认 Group Chat 相关 spec green；若 Ollama 不可达，记录 `@plus` skip 原因与环境差异。
4. 再运行 `RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e group-chat`，确认 lite 面板用例仍 green（无 M-4 回归）。
5. 验收后执行 compose down，确认无泄漏容器（AC-073 抽检）。

**预期结果**

- Plus 轨 Group Chat E2E 在可达环境下 green。
- Lite 轨 @any 用例不受 Plus 变更破坏。
- 环境不可用时有明确 skip/失败信息，非静默假绿。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-008：e2e-coverage-matrix Group Chat 行覆盖对照

**追溯 AC**: AC-040

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-040 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat |
| **所属轨** | Lite-only |

**前置条件**

- `docs/test/e2e-coverage-matrix.md` 含 E2E-N-groupChat 行
- M-4 E2E spec 已入库：`nodes/groupChat.spec.ts`、`group-chat-round-robin.spec.ts`、`group-chat-orchestrator-user-proxy.spec.ts`

**步骤**

1. 打开 matrix，定位 **E2E-N-groupChat** 行。
2. 确认 status 为 **covered**，轨为 **plus**，spec 列指向有效路径。
3. 对照 M-4 交付：round-robin、orchestrator、UserProxy 场景均有 E2E 覆盖（可跨多 spec 文件）。
4. 运行 `node scripts/validate-e2e-matrix.mjs`（若可用），确认 matrix 校验 green。

**预期结果**

- matrix Group Chat 相关行 100% covered，无「待补测」。
- spec 路径与仓库文件一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-009：M-4 验收清单 meta 自检

**追溯 AC**: AC-041, AC-070

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-041, AC-070 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 本文件 `M-4-acceptance.md` 已编写（T-097）

**步骤**

1. 确认 frontmatter 含 `ac_coverage: AC-035～044, AC-070`。
2. 确认「AC 映射摘要」表覆盖 AC-035～044 每条至少 1 个人工用例。
3. 确认含 **≥5 条 Plus 轨** 用例，覆盖 round-robin、orchestrator、UserProxy 三模式。
4. 逐条用例检查 PRD §9.1 字段：ID、前置条件、步骤、预期结果、所属轨、追溯 AC、执行结果栏。
5. 确认 OQ-009 说明：人工/E2E 互补、侧重 UX/文档/环境/边界。

**预期结果**

- 清单结构符合 PRD §9.1 与 OQ-009。
- AC-041（清单就绪）与 AC-070（人工门禁）可满足。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-010：groupChat 参数校验错误码边界可读性

**追溯 AC**: AC-043

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-043 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat, aiAgent |
| **所属轨** | Plus |

**前置条件**

- Web 编辑器可访问
- `docs/error-codes.md` 含 E1048、E1012、E1049 等 Group Chat 相关码

**步骤**

1. **E1048**：仅连接 1 个 group_member，保存或 debug-node，确认错误含 **E1048** 且消息说明「至少 2 名成员」。
2. **E1012**：2 个 aiAgent 连线但其一缺 aiChatModel，保存，确认 **E1012** 可读。
3. **E1049**：orchestrator 模式缺 orchestrator Agent/模型，保存或执行，确认 **E1049** 可读。
4. 对照 `docs/test/node-audit-rows/groupChat.md` 错误码表，确认与 UI 展示一致。
5. 修复配置后再次保存，确认错误清除、工作流可正常保存。

**预期结果**

- 三类边界错误码均可诊断，消息非裸 stack。
- 错误码可在 error-codes 文档映射。
- 修复后校验通过，无残留误报。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M4-MAN-011：spec-gap-audit GAP-011 Group Chat 状态抽检

**追溯 AC**: AC-044

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-044 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat |
| **所属轨** | Lite-only |

**前置条件**

- M-4 实现与 E2E/人工验收完成后验收本项
- `docs/workflow/spec-gap-audit.md` 含 GAP-011 行

**步骤**

1. 打开 `docs/workflow/spec-gap-audit.md`，定位 **GAP-011**（Group Chat MVP）。
2. 确认 status 为 **done**（非 partial/open），Milestone 列为 M-4。
3. 对照现状描述：native + langgraph、UserProxy/HITL、Plus E2E 均已验收。
4. 运行 `node scripts/validate-spec-gap-audit.mjs`（若 M-4 gate 要求 closed），确认无阻塞 open 项（Binary 等 M-5 项除外）。

**预期结果**

- GAP-011 在 M-4 放行前为 done。
- 差距描述与实现一致，无静默 defer。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## 验收签字

| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 验收人 | | | ☐ 通过 M-4 ☐ 退回 |
| 开发确认 | | | 11/11 用例已执行 |
