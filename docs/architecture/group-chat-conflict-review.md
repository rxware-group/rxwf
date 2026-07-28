---
status: approved
m4ImplementationGate: cleared
reviewDate: 2026-06-20
trace: AC-038
milestone: M-4
specRefs:
  - docs/spec.md FR-15.4-E / AC-21
  - docs/architecture/architecture.md §8 Group Chat
  - docs/superpowers/specs/2026-05-30-group-chat-design.md
  - docs/requirements/PRD.md AC-038 / NFR-09
---

# Group Chat 架构冲突评估（Crew / Agent 共存）

> **任务**：T-085 · **验收**：AC-038 · **门禁**：M-4 Wave 2+ 实现须本文件 `m4ImplementationGate: cleared`。

## 1. 目的与范围

在 M-4 Group Chat MVP 实施前，对照 `docs/architecture/architecture.md` **§8 Group Chat**、`2026-05-30-group-chat-design.md` 与现有 **Crew / aiAgent** 实现，识别是否存在**未确认的架构冲突**。若冲突触及 FR-16 大变动门禁（ExecutionEngine 调度语义、HITL 全局协议、Crew/Group Chat 资源模型结构性合并），须暂停并人工确认后再改框架。

**评估范围**：

| 在范围 | 不在范围 |
|--------|----------|
| `groupChat` 与 `crewSequential` / `crewSupervisor` / `crewHierarchical` 共存 | LangGraph 完整图迁移（post-M-4 可选） |
| `aiAgent` 卫星节点复用（Chat Model、Tools） | CrewAI Sidecar 新后端 |
| `to-workflow-graph` 编排边过滤 | Binary / M-5 门禁 |
| HITL `orchestrationResume.kind=groupChat` | 英文帮助、SSO |

**现状快照（T-084 后）**：

- `packages/workflow/src/group-members.ts`：`collectGroupMembers`、`isGroupChatOrchestrationConnection` 已落地。
- `packages/execution/src/graph/to-workflow-graph.ts`：Group Chat 编排边与 Crew 边**并列排除**，不参与 main DAG。
- `packages/node-runner/src/executors/group-chat.ts`：native loop + 可选 langgraph；UserProxy 强制 native。
- `packages/execution/src/hitl/resume-group-chat.ts`：单节点重入 scaffold 已存在；M-4 T-090/T-093 补全 API 链。
- M-3 T-064：`groupChat` 面板/校验/执行器/E1048 审查通过（stub 级）。

## 2. 评估方法

1. **代码路径对照**：Crew（`crew-members.ts`、`crew-native.ts`）与 Group Chat（`group-members.ts`、`group-chat.ts`）并行阅读。
2. **图编译**：确认 `isCrewOrchestrationConnection` / `isGroupChatOrchestrationConnection` 在 `to-workflow-graph.ts` 中对称处理。
3. **执行语义**：Group Chat 是否为「单节点内循环 + 可选 waiting/resume」，而非改动 ExecutionEngine 全局调度。
4. **可观测性**：`metadata.agentSteps` 命名空间是否与 Crew/独立 Agent 步骤并存。
5. **spec-gap**：对照 `docs/workflow/spec-gap-audit.md` GAP-011（Group Chat MVP partial）。
6. **FR-16 触发条件**：architecture.md §12.3 所列大变动是否被 Group Chat MVP 触及。

## 3. 冲突对照表

| ID | 冲突域 | 描述 | 影响级别 | 结论 | 人工确认 |
|----|--------|------|----------|------|----------|
| GC-01 | 资源端口模型 | `group_member` / `group_orchestrator` vs `crew_member` / `crew_manager` | 低 | 无冲突 | — |
| GC-02 | aiAgent 卫星复用 | 参与者共用 Chat Model、Tool 卫星与 `collectSatellites` 校验 | 低 | 无冲突 | — |
| GC-03 | 执行图编译 | 编排边不参与 main DAG；触发器 → `groupChat` → 下游 main 流 | 低 | 无冲突 | — |
| GC-04 | Agent 运行时 | Group Chat 循环内调用 `runAiAgentNode`；可选 `ai-runtime.runGroupChat` | 低 | 无冲突 | — |
| GC-05 | HITL resume 协议 | `orchestrationResume.kind=groupChat` + checkpoint 单节点重入 | 中 | 已接受差异 | 2026-06-20 编排器 |
| GC-06 | UserProxy vs humanApproval | 群聊内置 waiting vs 独立 HITL 节点 | 低 | 已接受差异 | 2026-06-20 OQ-010 决选 |
| GC-07 | 同一 aiAgent 双挂载 | 单个 Agent 同时连 Crew 与 Group Chat | 中 | 已接受差异 | 2026-06-20 评估 |
| GC-08 | ExecutionEngine 调度 | 不改为全图重跑；resume 仅重入 `groupChat` 节点 | 高 | 无冲突 | — |
| GC-09 | agentSteps 可观测 | `groupChatTurn` 等与 Crew 步骤并存于 `metadata.agentSteps` | 低 | 无冲突 | — |
| GC-10 | Plus 轨边界 | Group Chat 与 Crew 均要求 FEATURE_PLUS / compose.plus | 低 | 无冲突 | — |

## 4. 冲突项详细分析

### GC-01 资源端口模型 — 无冲突

Crew 与 Group Chat 采用**平行端口命名**（`crew_member` vs `group_member`），连接方向一致（参与者 resourceOutput → 根节点 resourceInput）。`validate.ts` 分别校验，无共享 mutable 状态。architecture.md §8.4 已决选「并列 filter」，**无需** FR-16 所指的「资源模型结构性合并」。

### GC-02 aiAgent 卫星复用 — 无冲突

Group Chat 成员与 Crew 工人使用同一 `aiAgent` 类型与 E1012（缺 Chat Model）校验。Tool 0~n 可选，ReAct 路径与独立 Agent 一致。无新增卫星类型。

### GC-03 执行图编译 — 无冲突

```typescript
// packages/execution/src/graph/to-workflow-graph.ts
!isCrewOrchestrationConnection(c) &&
!isGroupChatOrchestrationConnection(c)
```

main 流仅含 trigger → `groupChat` → 下游；参与者为卫星节点，与 Crew 拓扑规则对称。

### GC-04 Agent 运行时 — 无冲突

- **native（默认）**：`group-chat.ts` 内 FOR 循环调用 `runAiAgentNode`，与 `crew-native.ts` 模式一致。
- **langgraph（可选）**：`executionBackend=langgraph` 委托 `ai-runtime`；UserProxy 启用时强制 native（checkpoint 不可跨图）。两路径互斥，不改动 Crew Sidecar。

### GC-05 HITL resume 协议 — 已接受差异

Group Chat 扩展 HITL 为 **orchestration checkpoint**，非 humanApproval 的 approve/reject 二元语义：

| 维度 | humanApproval | Group Chat UserProxy |
|------|---------------|----------------------|
| waiting 原因 | 审批/补充 | 群聊纠偏插话 |
| resume 载荷 | decision + supplement | supplement → append user 消息 |
| 重入范围 | 单节点 | 单 `groupChat` 节点（同左） |

`resume-group-chat.ts` 已实现单节点重入 scaffold；**不修改** ExecutionEngine 全局 HITL 枚举。M-4 T-093 集成 API 即可，无需 FR-16 暂停。

### GC-06 UserProxy vs humanApproval — 已接受差异

OQ-010 已决选：`userProxyTimeoutMs` 默认 **-1（不超时）**；正数超时 → 审计 + **失败终止**（E1048 族）。与外部 HITL 节点**并存**：工作流可同时含 `humanApproval` 与 `groupChat` UserProxy，互不替换。

### GC-07 同一 aiAgent 双挂载 — 已接受差异

当前 `validate.ts` **未禁止** 同一 `aiAgent` 同时输出 `crew_member` 与 `group_member`。运行时仅在被挂载的根节点循环内执行，**不会**在同一 execution 中同时进入 Crew 与 Group Chat 循环（需工作流作者分别连 main 流触发）。

**产品约定（M-4）**：不新增「互斥校验」；帮助文档（T-144）说明「同一 Agent 仅应参与一种编排根节点」。若后续需 E105x 硬校验，列为 post-M-4 增强，**非** M-4 阻断项。

### GC-08 ExecutionEngine 调度 — 无冲突

Group Chat MVP **不要求**更改 ExecutionEngine 拓扑调度、并发或 error workflow 语义。waiting/resume 为节点级 `status: waiting` + API 重入，与 M-3 HITL 基础设施一致。architecture.md §12.3「更改 ExecutionEngine 调度语义」**未触发**。

### GC-09 agentSteps 可观测 — 无冲突

Group Chat 使用 discriminated step types（`groupChatTurn`、`groupChatUserProxy`、`groupChatFinish`、`groupChatUserProxyTimeout`）。Crew 步骤保持原有 shape；timeline UI（T-092）按 `type` 分支渲染，无字段覆盖。

### GC-10 Plus 轨边界 — 无冲突

与 Crew 相同：`registerPlusExecutors` 注册 `groupChat`；Lite 轨保存可校验但执行需 Plus。E2E 矩阵行 `E2E-N-groupChat` 标注 `plus`，与 AC-039 一致。

## 5. M-4 实施门禁结论

| 检查项 | 结果 |
|--------|------|
| 存在未决 FR-16 级冲突 | **否** |
| 需 Crew/Group Chat 资源模型合并 | **否** |
| 需变更 ExecutionEngine 全局调度 | **否** |
| spec-gap GAP-011 阻断评估 | **否**（partial 属 MVP 待交付，非架构冲突） |
| **m4ImplementationGate** | **cleared** |

**结论（AC-038）**：Group Chat 与现有 Crew/Agent **无未确认架构冲突**。GC-05、GC-06、GC-07 为**已文档化的设计差异**，已在 OQ-004 / OQ-010 / 本评估中接受，**不暂停** M-4 实现。

**后续任务可启动**：T-086（参数 schema）→ T-087/T-088（执行器）→ T-090+（UserProxy/HITL）→ T-094/T-095（E2E）。

### 5.1 人工确认记录

| 日期 | 确认项 | 结论 | 记录位置 |
|------|--------|------|----------|
| 2026-05-30 | Group Chat MVP 纳入 v2.0；架构冲突须评估后实施 | 纳入 | plan.md OQ-004 |
| 2026-06-20 | UserProxy 超时默认 -1；超时失败终止 | 已决选 | PRD OQ-010；architecture.md §8.3 |
| 2026-06-20 | GC-07 双挂载：文档约定，非 M-4 硬校验 | 已接受 | 本节 GC-07 |
| 2026-06-20 | AC-038 冲突评估完成，M-4 gate cleared | **cleared** | 本文件 frontmatter |

### 5.2 须持续监控的风险（非阻断）

1. **T-093 API 集成**：若 resume 路径误触发全图重跑，回退为 GC-08 冲突并 **blocked** gate。
2. **LangGraph 路径 + UserProxy**：已强制 native；若产品要求 langgraph + UserProxy，须新 ADR。
3. **Crew Sidecar 与 Group Chat 同工作流**：Plus 资源竞争由 compose 容量解决，非架构合并。

---

**维护**：M-4 合入前若 ExecutionEngine / HITL 核心变更，须重跑 `node docs/architecture/group-chat-conflict-review.test.mjs` 并更新 §3 对照表。
