# Shell 工具卫星

## 用途

**toolShell** 将 **Shell 命令执行** 注册为 Agent Tool。LLM 传入 `command`（必填）及可选 `cwd`、`timeoutMs`，由 **Agent Runner** 经 `runnerGateway.invokeTool` 执行（capability `shell`）。**Embedded** API 进程内对 shell 返回 **E1057**（v1 设计限制），生产 Agent 须配置带 shell 能力的远程 Runner。

## 端口与连接

```
toolShell ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
```

Runner 需求：`getNodeRunnerRequirements('toolShell')` → `capabilities: ['shell']`，平台 linux / windows / macos。

## 参数

| 参数 | 说明 |
|------|------|
| **工作目录**（`cwd`） | 可选；相对 `scanRoots[0]`；支持 `{{ }}` 表达式 |
| **Tool 描述** | 可选；留空使用内置 Agent 描述 |

### LLM 调用参数

| 参数 | 说明 |
|------|------|
| `command` | Shell 命令字符串，**必填** |
| `cwd` | 覆盖节点默认 cwd |
| `timeoutMs` | 可选超时毫秒 |

**安全提示**：Shell Tool 仅在受信 Runner 上启用；生产环境应限制 scanRoots 与 Runner 标签。Windows 与 Unix 命令语法由 LLM 与 Runner 平台共同决定。

面板 **工作目录** 留空时默认相对 scanRoots 第一项；LLM 可在单次调用中覆盖 `cwd`。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1057** | **Embedded** 路径未启用 shell（API 内 debug 常见） |
| **E2002** | 未知 capability 或 method |
| **E3012** | invoke 路由错误或 Runner 失败 |
| **E3010** | 父 Agent 缺 Chat Model |

## 示例

### 示例 A

1. 工作流 **Runner 策略** 指向带 `shell` 能力的 Runner
2. `toolShell` 连到 `aiAgent` + Chat Model
3. Prompt：「用 shell 工具列出项目根目录文件」
4. LLM 调用 `command: "ls -la"` 或 Windows 等价命令

### 示例 B

- 节点 **工作目录** 填 `packages/api`
- 或 LLM 传 `cwd` 相对 scanRoot

### 示例 C

在仅 Embedded Runner 环境调试时，Shell Tool 调用会 **E1057**；属预期行为。请改用远程 Runner 或在 Skill 中避免 shell 依赖。

## 参见

- [Execute Command 节点](/help/nodes/executeCommand) — 主数据流命令执行
- [Read 工具卫星](/help/nodes/toolRead)
- [AI Agent 节点](/help/nodes/aiAgent) — Runner 策略
