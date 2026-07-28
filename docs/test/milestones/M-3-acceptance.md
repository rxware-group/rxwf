---
milestone: M-3
version: 1
updated: 2026-06-20
ac_coverage:
  - AC-023
  - AC-024
  - AC-025
  - AC-026
  - AC-027
  - AC-028
  - AC-029
  - AC-030
  - AC-031
  - AC-032
  - AC-033
  - AC-034
  - AC-070
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
node_type_count: 46
---

# M-3 人工验收用例

> **Milestone**：M-3 — 全节点审查与修复（Docker 真实依赖，Standard + Plus 双轨）  
> **追溯**：FR-09, FR-18 / AC-023～034, AC-070 / PRD §5.3、§9  
> **E2E 互补**（OQ-009）：本清单侧重 E2E **无法覆盖** 的 **UX**、**文档可读性**、**本地环境验证** 与 **边界场景**；与 `apps/web/e2e/nodes/*.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-3`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix 行 | E2E 互补说明 |
|----|--------|----------|-----------|--------------|
| AC-023 | 节点审查矩阵 100% 有结论 | M3-MAN-048 | — | 人工矩阵 status 抽检 |
| AC-024 | 无外部依赖节点冒烟 | M3-MAN-001～046（lite 子集） | E2E-N-* | E2E 验执行；人工验面板/边界 UX |
| AC-025 | Postgres/Redis Standard 真实验收 | postgres, executeCommand 等 | E2E-N-postgres 等 | 人工验 compose 连接 UX |
| AC-026 | Ollama/LLM 真实验收 | ollama, llmStream, aiAgent 等 | E2E-N-ollama 等 | 人工验 Ollama 可达提示 |
| AC-027 | Crew/Agent/MCP Plus 真实验收 | crew*, ai*, tool*, mcpClient 等 | E2E-N-* | 人工验卫星接线与环境 |
| AC-028 | 每 nodeType ≥1 E2E green | M3-MAN-049 | E2E-N-* | E2E 验 green；人工验本地可复现 |
| AC-029 | matrix nodeType 行关联 E2E spec | M3-MAN-049 | — | 人工 matrix e2e_spec 列对照 |
| AC-030 | 失败错误码可映射文档 | 各 nodeType 用例 | — | 人工边界失败消息可读性 |
| AC-031 | 本验收清单全通过 | M3-MAN-047 | — | meta 自检 |
| AC-032 | 全量 E2E green 双轨 | M3-MAN-049 | — | Lite+Standard+Plus 复现 |
| AC-033 | 审查缺陷已处置 | M3-MAN-048 | — | 无静默 defer |
| AC-034 | 矩阵双源一致 | M3-MAN-050 | — | meta+executor 对照 |
| AC-070 | Milestone 人工用例全通过 | M3-MAN-047 | — | 放行门禁 |

---

## 用例清单（按 nodeType）

### M3-MAN-001：aiAgent 卫星接线 UX 与 Plus 环境边界

**追溯 AC**: AC-026, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-026, AC-030 |
| **matrix 行** | E2E-N-aiAgent |
| **nodeType** | aiAgent |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/aiAgent.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/aiAgent.md`，确认 panel/validation/executor 均为 ok。
2. 编辑器添加 aiAgent + aiChatModel（ai_languageModel 连线），打开参数面板核对 Prompt、Crew 标签字段。
3. 断开 Chat Model，保存后 debug-node，确认失败信息含 **E3010** 且可读（非裸 stack）。
4. Plus compose 启动时，确认 Ollama 不可达有明确环境提示而非静默挂起。

**预期结果**

- 面板字段与审查记录一致；卫星端口标签清晰。
- 无 Chat Model 时边界错误 E3010 用户可读。
- Plus 环境依赖缺失时有可行动提示。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-002：aiChatModel 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-aiChatModel |
| **nodeType** | aiChatModel |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/aiChatModel.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/aiChatModel.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **aiChatModel** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-aiChatModel**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-aiChatModel 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-003：aiKnowledge 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-aiKnowledge |
| **nodeType** | aiKnowledge |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/aiKnowledge.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/aiKnowledge.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **aiKnowledge** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-aiKnowledge**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-aiKnowledge 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-004：aiMemory 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-aiMemory |
| **nodeType** | aiMemory |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/aiMemory.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/aiMemory.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **aiMemory** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-aiMemory**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-aiMemory 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-005：aiOutputParser 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-aiOutputParser |
| **nodeType** | aiOutputParser |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/aiOutputParser.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/aiOutputParser.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **aiOutputParser** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-aiOutputParser**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-aiOutputParser 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-006：code 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-code |
| **nodeType** | code |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/code.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/code.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **code** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-code**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-code 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-007：crewHierarchical 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-crewHierarchical |
| **nodeType** | crewHierarchical |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/crewHierarchical.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/crewHierarchical.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **crewHierarchical** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-crewHierarchical**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-crewHierarchical 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-008：crewSequential 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-crewSequential |
| **nodeType** | crewSequential |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/crewSequential.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/crewSequential.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **crewSequential** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-crewSequential**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-crewSequential 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-009：crewSupervisor 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-crewSupervisor |
| **nodeType** | crewSupervisor |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/crewSupervisor.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/crewSupervisor.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **crewSupervisor** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-crewSupervisor**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-crewSupervisor 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-010：errorTrigger 面板 UX 与 Standard 轨边界验收

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-errorTrigger |
| **nodeType** | errorTrigger |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/errorTrigger.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. 打开 `docs/test/node-audit-rows/errorTrigger.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **errorTrigger** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-errorTrigger**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Standard compose（Postgres/Redis）启动后，确认依赖节点可配置连接且错误非静默。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-errorTrigger 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-011：executeCommand 面板 UX 与 Standard 轨边界验收

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-executeCommand |
| **nodeType** | executeCommand |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/executeCommand.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. 打开 `docs/test/node-audit-rows/executeCommand.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **executeCommand** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-executeCommand**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Standard compose（Postgres/Redis）启动后，确认依赖节点可配置连接且错误非静默。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-executeCommand 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-012：executeWorkflow 面板 UX 与 Standard 轨边界验收

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-executeWorkflow |
| **nodeType** | executeWorkflow |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/executeWorkflow.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. 打开 `docs/test/node-audit-rows/executeWorkflow.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **executeWorkflow** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-executeWorkflow**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Standard compose（Postgres/Redis）启动后，确认依赖节点可配置连接且错误非静默。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-executeWorkflow 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-013：groupChat 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-groupChat |
| **nodeType** | groupChat |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/groupChat.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/groupChat.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **groupChat** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-groupChat**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-groupChat 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-014：httpRequest 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-httpRequest |
| **nodeType** | httpRequest |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/httpRequest.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/httpRequest.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **httpRequest** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-httpRequest**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-httpRequest 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-015：humanApproval HITL 面板与审批等待 UX

**追溯 AC**: AC-024, AC-033

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-033 |
| **matrix 行** | E2E-N-humanApproval |
| **nodeType** | humanApproval |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/humanApproval.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 添加 humanApproval 节点，确认 prompt、timeoutMs、allowReject、allowSupplement 字段可读。
2. 运行含 humanApproval 的工作流，确认执行暂停为 **waiting** 态且有 HITL 提示。
3. 在审批 UI 执行通过/驳回，确认分支路由符合配置。
4. 查阅 `docs/test/node-audit-rows/humanApproval.md` 确认 T-044 布尔解析修复已记录。

**预期结果**

- HITL 等待态 UX 可辨识，非静默阻塞。
- 布尔 select 存取与执行器一致（边界：字符串 true/false）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-016：if 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-if |
| **nodeType** | if |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/if.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/if.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **if** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-if**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-if 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-017：json 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-json |
| **nodeType** | json |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/json.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/json.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **json** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-json**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-json 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-018：llmStream 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-llmStream |
| **nodeType** | llmStream |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/llmStream.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/llmStream.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **llmStream** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-llmStream**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-llmStream 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-019：loop 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-loop |
| **nodeType** | loop |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/loop.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/loop.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **loop** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-loop**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-loop 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-020：manualTrigger 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-manualTrigger |
| **nodeType** | manualTrigger |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/manualTrigger.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/manualTrigger.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **manualTrigger** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-manualTrigger**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-manualTrigger 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-021：mcpClient 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-mcpClient |
| **nodeType** | mcpClient |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/mcpClient.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/mcpClient.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **mcpClient** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-mcpClient**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-mcpClient 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-022：merge 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-merge |
| **nodeType** | merge |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/merge.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/merge.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **merge** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-merge**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-merge 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-023：ollama 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-ollama |
| **nodeType** | ollama |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/ollama.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/ollama.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **ollama** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-ollama**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-ollama 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-024：postgres SQL 面板 UX 与 Standard Docker 环境

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-postgres |
| **nodeType** | postgres |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/postgres.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. Standard compose profile 启动 API/Web，确认 `RXWF_DATABASE_URL` 已注入。
2. 编辑器添加 postgres 节点，打开 SQL 面板，确认 query 字段为 textarea 且可编辑。
3. 保存空白 query 工作流，debug-node 确认 **E2002**；移除 connectionString 模拟无 URL，确认 **E2003**。
4. 合法 `SELECT 1` 在 Docker Postgres 下执行成功，运行详情展示 rows/rowCount。

**预期结果**

- 面板 SQL 字段 UX 可读；错误码与 `docs/error-codes.md` 一致。
- Standard 轨真实 Postgres 验收通过（E2E 互补：人工验连接配置 UX）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-025：ragAnswer 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-ragAnswer |
| **nodeType** | ragAnswer |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/ragAnswer.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/ragAnswer.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **ragAnswer** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-ragAnswer**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-ragAnswer 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-026：ragRetrieve 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-ragRetrieve |
| **nodeType** | ragRetrieve |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/ragRetrieve.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/ragRetrieve.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **ragRetrieve** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-ragRetrieve**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-ragRetrieve 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-027：readWriteFile 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-readWriteFile |
| **nodeType** | readWriteFile |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/readWriteFile.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/readWriteFile.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **readWriteFile** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-readWriteFile**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-readWriteFile 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-028：scheduleTrigger 面板 UX 与 Standard 轨边界验收

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-scheduleTrigger |
| **nodeType** | scheduleTrigger |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/scheduleTrigger.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. 打开 `docs/test/node-audit-rows/scheduleTrigger.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **scheduleTrigger** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-scheduleTrigger**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Standard compose（Postgres/Redis）启动后，确认依赖节点可配置连接且错误非静默。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-scheduleTrigger 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-029：set 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-set |
| **nodeType** | set |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/set.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/set.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **set** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-set**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-set 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-030：skillRun Tool 卫星显式接线 UX（M-2 延续）

**追溯 AC**: AC-027, AC-033

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-033 |
| **matrix 行** | E2E-N-skillRun |
| **nodeType** | skillRun |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/skillRun.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/help/zh/nodes/skillRun.md`（若存在）或 audit row，确认显式 toolWrite/toolGrep/toolWebSearch 说明。
2. 画布添加 skillRun + aiChatModel + toolWrite（ai_tool 连线），确认无「自动启用 Builtin」开关。
3. 参数面板确认 skillSource、timeoutMs 默认 **-1** 与帮助一致。
4. 断开全部 Tool 卫星保存，确认无静默降级提示。

**预期结果**

- Tool 卫星须显式接线，UX 与 M-2 决选一致。
- 参数默认值与审查记录一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-031：splitInBatches 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-splitInBatches |
| **nodeType** | splitInBatches |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/splitInBatches.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/splitInBatches.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **splitInBatches** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-splitInBatches**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-splitInBatches 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-032：subworkflowTrigger 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-subworkflowTrigger |
| **nodeType** | subworkflowTrigger |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/subworkflowTrigger.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/subworkflowTrigger.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **subworkflowTrigger** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-subworkflowTrigger**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-subworkflowTrigger 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-033：switch 动态分支面板 UX（M-2 模型）

**追溯 AC**: AC-024, AC-022

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-022 |
| **matrix 行** | E2E-N-switch |
| **nodeType** | switch |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/switch.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/help/zh/nodes/switch.md`，确认 branches[] 模型与无 fallback 说明。
2. 编辑器 switch 节点打开 SwitchBranchesPanel：添加 3 条分支，编辑 label/condition。
3. 删除中间分支，确认出边清理或提示。
4. 保存重开，确认 branches 持久化；帮助页 `/help/zh/nodes/switch` 渲染可读。

**预期结果**

- 动态分支 UX 完整，非旧 outputCount 模型。
- 文档与面板参数命名一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-034：toolGrep 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolGrep |
| **nodeType** | toolGrep |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolGrep.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolGrep.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolGrep** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolGrep**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolGrep 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-035：toolHttp 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolHttp |
| **nodeType** | toolHttp |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolHttp.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolHttp.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolHttp** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolHttp**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolHttp 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-036：toolMcp 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolMcp |
| **nodeType** | toolMcp |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolMcp.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolMcp.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolMcp** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolMcp**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolMcp 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-037：toolRead 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolRead |
| **nodeType** | toolRead |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolRead.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolRead.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolRead** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolRead**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolRead 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-038：toolShell 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolShell |
| **nodeType** | toolShell |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolShell.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolShell.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolShell** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolShell**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolShell 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-039：toolSkill 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolSkill |
| **nodeType** | toolSkill |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolSkill.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolSkill.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolSkill** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolSkill**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolSkill 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-040：toolSubagent 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolSubagent |
| **nodeType** | toolSubagent |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolSubagent.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolSubagent.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolSubagent** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolSubagent**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolSubagent 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-041：toolWebSearch 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolWebSearch |
| **nodeType** | toolWebSearch |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolWebSearch.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolWebSearch.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolWebSearch** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolWebSearch**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolWebSearch 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-042：toolWorkflow 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolWorkflow |
| **nodeType** | toolWorkflow |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolWorkflow.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolWorkflow.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolWorkflow** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolWorkflow**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolWorkflow 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-043：toolWrite 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-toolWrite |
| **nodeType** | toolWrite |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/toolWrite.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/toolWrite.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **toolWrite** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-toolWrite**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-toolWrite 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-044：wait 面板 UX 与 Lite-only 轨边界验收

**追溯 AC**: AC-024, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-024, AC-030 |
| **matrix 行** | E2E-N-wait |
| **nodeType** | wait |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/wait.md` 审查结论为 ok（T-080）
- Lite 轨：本地 Web + API 可启动，无 Plus 硬依赖

**步骤**

1. 打开 `docs/test/node-audit-rows/wait.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **wait** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-wait**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Lite 轨本地启动 Web/API，确认无 Plus 专属依赖硬失败。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-wait 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-045：webhookTrigger 鉴权面板与 curl 示例 UX

**追溯 AC**: AC-025, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-025, AC-030 |
| **matrix 行** | E2E-N-webhookTrigger |
| **nodeType** | webhookTrigger |
| **所属轨** | Standard |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/webhookTrigger.md` 审查结论为 ok（T-080）
- Standard compose（Postgres + Redis）可启动

**步骤**

1. 添加 webhookTrigger，打开专用面板：配置 path、authMode（none/apiKey/apiKeyHmac）。
2. 切换鉴权模式，确认 API Key / HMAC Secret 字段显隐符合模式。
3. 确认面板展示测试/生产 URL 与 **curl 示例**可复制。
4. 发布工作流后，用错误 API Key 调用 webhook，确认 HTTP 层错误可读（E1001/E2005 等）。

**预期结果**

- 鉴权面板 UX 清晰，无裸参数 key。
- 边界鉴权失败返回可映射错误码，非 500 裸文本。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-046：workflow_run 面板 UX 与 Plus 轨边界验收

**追溯 AC**: AC-027, AC-030

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-027, AC-030 |
| **matrix 行** | E2E-N-workflow_run |
| **nodeType** | workflow_run |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-3-node-audit` 分支
- `docs/test/node-audit-rows/workflow_run.md` 审查结论为 ok（T-080）
- Plus compose profile 可启动（Ollama/MCP/Runner 等按节点需要）

**步骤**

1. 打开 `docs/test/node-audit-rows/workflow_run.md`，确认 status=ok 且 panel/validation/executor 有结论。
2. 编辑器添加 **workflow_run** 节点，打开参数面板：字段标签、placeholder、端口名称可读。
3. 对照 `docs/test/e2e-coverage-matrix.md` 行 **E2E-N-workflow_run**，确认 E2E 已覆盖；人工抽检 **审查记录对照、参数面板可读性、错误码边界（非 E2E 重复路径）**。
4. Plus compose（Ollama/MCP/Crew 等）启动后，确认环境不可用时有用户可读提示。
5. 故意触发一条边界（空必填项/无效表达式/缺卫星），确认错误码可在 `docs/error-codes.md` 映射且消息可读。

**预期结果**

- 面板与审查矩阵 AUDIT-N-workflow_run 一致。
- UX/文档/环境/边界场景已人工确认（OQ-009）。
- 失败路径错误信息用户可读，非仅 console。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## Milestone 元验收用例

### M3-MAN-047：M-3 验收清单结构与 AC 映射自检

**追溯 AC**: AC-031, AC-070

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-031, AC-070 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 全部 nodeType 用例 M3-MAN-001～046 已编写

**步骤**

1. 确认 frontmatter `ac_coverage` 含 AC-023～AC-034、AC-070。
2. 确认本清单含每个可执行 nodeType 至少 1 条用例（OQ-009）。
3. 确认每条用例 `**nodeType**` 表覆盖 `loadExecutableNodeTypes()` 全部 46 个可执行类型（无遗漏）。
4. 确认每条用例含 PRD §9.1 字段：ID、前置、步骤、预期、所属轨、追溯、执行结果栏。

**预期结果**

- 清单满足 FR-12 / AC-031；结构与 M-1/M-2 模板一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-048：node-audit-matrix 100% 审查结论抽检

**追溯 AC**: AC-023, AC-033

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-023, AC-033 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 全部 nodeType 用例 M3-MAN-001～046 已编写

**步骤**

1. 运行 `node scripts/validate-node-audit-matrix.mjs`，确认 exit 0。
2. 打开 `docs/test/node-audit-matrix.md`，抽检 5 行 status=ok 与 audit_row 文件存在。
3. 确认无 pending 行；skillRun 合成行 notes 已标注。

**预期结果**

- AC-023 100% 有结论；缺陷已修复或 notes 说明处置。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-049：M-3 全量 E2E green 与双轨可复现

**追溯 AC**: AC-028, AC-029, AC-032

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-028, AC-029, AC-032 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 全部 nodeType 用例 M3-MAN-001～046 已编写

**步骤**

1. 运行 `node scripts/validate-e2e-matrix.mjs`，确认每个 nodeType 行 status=covered。
2. 本地运行 `pnpm --filter @rxwf/web test:e2e`（Lite）；Plus/Standard 轨按 matrix 标注分别启动 compose 后跑对应 `@plus`/`@standard` 用例。
3. 确认 exit 0；失败时记录 spec 名与环境 profile。

**预期结果**

- 全量 E2E green；Standard 与 Plus 轨用例均可本地复现。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M3-MAN-050：NODE_TYPE_META 与执行器 registry 双源一致抽检

**追溯 AC**: AC-034

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-034 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 全部 nodeType 用例 M3-MAN-001～046 已编写

**步骤**

1. 运行 `node scripts/generate-node-audit-matrix.mjs --check`（若可用）或 `validate-node-audit-matrix.mjs`。
2. 抽检 3 个 executor=ok 节点在执行器 register 文件中有对应 type。
3. 抽检 3 个 executor=satellite 节点在 SATELLITE_NODE_TYPES 中登记。

**预期结果**

- 矩阵与双源一致，无 unknown node type 或 missing executor 漏项。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## 验收签字

| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 验收人 | | | ☐ 通过 M-3 ☐ 退回 |
| 开发确认 | | | 50/50 用例已执行 |
