# Write 工具卫星

## 用途

**toolWrite** 将 **工作区文件写入** 能力注册为 Agent Tool。LLM 传入 `path` 与 `content`（及可选 `append`），运行时经 `skill:filesystem` / `write` 在 **scanRoots** 内创建或覆盖文件。与主数据流 **Read/Write File** 节点不同，本节点仅作为 **ai_tool 卫星** 供 ReAct 循环按需调用。

## 端口与连接

```
toolWrite ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
aiChatModel ──ai_languageModel──→ 父 Agent
```

写入范围受父 Agent 的 **scanRoots** 限制（`aiAgent.workspaceRoot` 或 Skill Run 工作区）。

## 参数

| 参数 | 说明 |
|------|------|
| **默认编码**（`defaultEncoding`） | 当前仅 `utf8` |
| **Tool 描述** | 可选；留空时使用内置 i18n 描述 |

### LLM 调用参数

| 参数 | 说明 |
|------|------|
| `path` | 工作区内相对路径，**必填** |
| `content` | 写入内容，**必填** |
| `append` | 可选 boolean；为 true 时追加而非覆盖 |

工具名取卫星节点 **画布标题**（如命名为 `write_file`）。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 对 toolWrite 直接 debug-node |
| **E2002** | `path` 为空 |
| **E1056** | 路径超出 scanRoots |
| **E1041** | 目录创建或写入 IO 失败 |
| **E3012** | 不支持的 invoke 路由 |

**Embedded** API 进程内写入；**远程 Runner** 需节点具备 `file` capability（`node-runner-requirements.ts`）。`append: true` 时在已有文件末尾追加，不会自动创建父目录以外的路径。

## 示例

### 示例 A

1. **设置 → RxWF** 保存工作区
2. `aiAgent` + `aiChatModel` + `toolWrite`（命名 `write_file`）
3. System：「需要落盘时使用 write_file」
4. Prompt：`{ "task": "将摘要写入 docs/summary.md" }`

### 示例 B

- 同时挂载 `toolRead` 与 `toolWrite`
- Agent 先读后改再写回（路径均须在 scanRoots 内）

### 示例 C

```
skillRun + aiChatModel + toolWrite + toolRead
```

Skill Run **不再隐式注入** Write；须在画布 **显式连接** toolWrite 卫星。

## 参见

- [Read 工具卫星](/help/nodes/toolRead)
- [Grep 工具卫星](/help/nodes/toolGrep)
- [Skill Run 节点](/help/nodes/skillRun)
