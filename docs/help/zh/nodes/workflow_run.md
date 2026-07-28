# Workflow Run 节点

## 用途

**Workflow Run** 在 Agent 工作流或 Skill 链路中执行 **`.rxwf/workflows/` 下的 YAML 模板**，或调用 **已发布子工作流**。编译器将 YAML 转为线性 `skillRun` 子图并在子执行中运行；适合把可复用流程封装为模板，由主流程传入 Items 触发。

与 **Execute Workflow** 的区别：本节点面向 Skill/Agent 轨道的 `.workflow.yaml` 模板或 `published` 源；Execute Workflow 面向平台已发布工作流 ID 的主数据流调用。

## 端口与连接

```
上游（manualTrigger / set / aiAgent …）──main──→ workflow_run ──main──→ 下游
```

| 端口 | ID | 说明 |
|------|-----|------|
| **输入** | `main` | 上游 Items 作为子执行输入 |
| **输出** | `main` | 子执行结果；通常含 `items`、`childExecutionId` 等 |

## 参数

| 参数 | 说明 |
|------|------|
| **工作流来源**（`workflowSource`） | `template`（默认）：读工作区 YAML；`published`：执行已发布工作流 |
| **模板路径**（`workflowRelPath`） | `template` 时必填；`.rxwf/workflows/` 下相对路径，可省略 `.workflow.yaml` 后缀 |
| **工作流 ID**（`workflowId`） | `published` 时必填 |
| **工作区根**（`workspaceRoot`） | RxWF 工作区；留空则运行时用 `process.cwd()` |
| **展开模板**（`expandTemplate`） | 编辑器侧是否将模板展开为子图预览（`true`/`false`） |

须在 **设置 → RxWF** 启用 workflows（`rxwf.project.json` 中 `workflows.enabled` 不为 `false`）。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1076** | `template` 缺 `workflowRelPath`，或 `published` 缺 `workflowId`；非法 `workflowSource` |
| **E1075** | 工作区 manifest 禁用 workflows |
| **E1073** | 模板文件不存在 |
| **E2003** | 执行器未注册；或 `published` 源缺子流运行时 / `parentExecutionId` |

更多见 [error-codes.md](../../../error-codes.md)。

## 示例

### 示例 A

1. 在 `.rxwf/workflows/` 放置 `mini.workflow.yaml`（E2E 与单测均使用该名）
2. 添加 `workflow_run`：**工作流来源** = `template`，**模板路径** = `mini`
3. **工作区根** 指向含 `.rxwf` 的目录（或在 **设置 → RxWF** 保存工作区）
4. `manualTrigger` → `workflow_run` → 下游；调试后 OUTPUT 含 `childExecutionId` 与 `items`

### 示例 B

1. 将目标工作流 **发布**，记下工作流 ID
2. **工作流来源** 选 `published`，**工作流 ID** 填该 ID
3. 上游传入子流所需 JSON Items
4. 成功输出含 `childExecutionId` 与 `workflowId`

### 示例 C

仓库内 E2E 用例在临时工作区写入 `mini.workflow.yaml` 后 debug-node，参见 `apps/web/e2e/nodes/workflow_run.spec.ts`。集成测试见 `apps/api/src/integration/workflow-run-pipeline.integration.test.ts`。

## 参见

- [Execute Workflow 节点](/help/nodes/executeWorkflow) — 主数据流调用已发布工作流
- [Skill Run 节点](/help/nodes/skillRun) — YAML 编译目标节点类型
