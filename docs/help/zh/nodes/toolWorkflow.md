# Workflow Tool 卫星

## 用途

**toolWorkflow** 将 **已发布且开启 exposeAsTool 的子工作流** 注册为 Agent Tool。LLM 传入子流所需参数后，运行时经 `runSubworkflow` 执行子工作流并返回其 **outputItems**。适合把复杂子流程封装为可复用 Tool，由主 Agent 按需触发。

与 **Execute Workflow** 的区别：本节点为 **卫星**，由 ReAct 循环触发；Execute Workflow 为主数据流节点。

## 端口与连接

```
toolWorkflow ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
```

子工作流须含 **subworkflowTrigger** 且在工作流设置中 **exposeAsTool = true**。

## 参数

| 参数 | 说明 |
|------|------|
| **子工作流**（`workflowId`） | 已发布、exposeAsTool 的工作流 ID（面板下拉，排除当前工作流） |
| **Tool 描述**（`toolDescription`） | **必填** |
| **输入映射**（`inputMapping`） | 可选 JSON；LLM 参数 → 子流输入字段；留空时用 subworkflowTrigger schema 字段名 |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1001** | 保存期缺 `workflowId` |
| **E1022** | 目标工作流不存在 |
| **E1023** | 目标未发布 |
| **E1024** | 未开启 exposeAsTool |
| **E1055** | 目标缺少 subworkflowTrigger |
| **E1054** | 运行时必填子流入参缺失 |
| **E1050** | 只读 `toolSubagent` 禁止挂载 toolWorkflow |
| **E3012** | `runSubworkflow` 未配置 |
| **E2003** | 对 toolWorkflow 直接 debug-node |

## 示例

### 示例 A

1. 创建子工作流：`subworkflowTrigger` → `set` → …，**发布** 并勾选 **作为 Tool 暴露**
2. 主工作流添加 `toolWorkflow`，选择该子流 ID，填写 Tool 描述
3. **ai_tool** 连到 `aiAgent` + Chat Model
4. Prompt 引导 Agent 调用该 Tool 并传入子流字段

### 示例 B

子流 trigger 定义字段 `city`、`days`；**inputMapping**：

```json
{
  "city": "{{ $fromAI(\"city\", \"City name\") }}",
  "days": "{{ $fromAI(\"days\", \"Number of days\") }}"
}
```

### 示例 C

- 每次 Tool 调用 `subworkflowDepth + 1`
- 平台默认 **maxAgentDepth** 限制嵌套 Agent/子流层数；超限 **E1048**

## 参见

- [Subworkflow Trigger 节点](/help/nodes/subworkflowTrigger) — 子流入口 schema
- [Execute Workflow 节点](/help/nodes/executeWorkflow) — 主流程调用子流
- [Subagent Tool 卫星](/help/nodes/toolSubagent) — 嵌套 ReAct Agent
