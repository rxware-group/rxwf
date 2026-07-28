# Read 工具卫星

## 用途

**toolRead** 将 **工作区文件读取** 能力注册为 Agent Tool。LLM 传入 `path` 或 `target_file`，运行时经 `skill:filesystem` / `read` 返回文本内容。与主数据流文件节点不同，本卫星仅在 ReAct 循环中被模型按需调用。

## 端口与连接

```
toolRead ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
aiChatModel ──ai_languageModel──→ 父 Agent
```

## 参数

| 参数 | 说明 |
|------|------|
| **Tool 描述** | 可选；留空时使用内置 i18n 描述（按界面语言） |

路径由 LLM 在工具调用时传入，不在节点参数中固定。

### 工作区与 scanRoots

| 父节点 | scanRoots 来源 |
|--------|----------------|
| `skillRun`（path） | 节点 **workspaceRoot** |
| `skillRun`（registry） | **设置 → RxWF** 工作区 |
| `aiAgent` | `workspaceRoot` 或进程 cwd |

### LLM 调用参数

| 参数 | 说明 |
|------|------|
| `path` | 工作区内文件路径 |
| `target_file` | `path` 别名 |

工具名使用节点 **画布标题**；与 SKILL 别名一致时可命名为 `read_file`。

**Embedded** 经 Runner Gateway 调用 `skill:filesystem` / `read`；**远程 Runner** 需 `file` capability。二进制文件可能返回编码提示或截断说明。

与 **Read/Write File** 主节点不同：Read Tool 仅在 Agent ReAct 内按需调用，不会在主数据流自动执行。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 对 toolRead 直接 debug-node |
| **E3012** | 路径无效、越界、文件不存在或 Runner 错误 |
| **E1056** | 路径超出 scanRoots |

## 示例

### 示例 A

1. **设置 → RxWF** 保存并扫描工作区
2. `skillRun` + `aiChatModel` + `toolRead`（命名 `read_file`）
3. 上游 JSON：`{ "question": "总结 README 要点" }`
4. Agent 调用 `read_file`，`path: "README.md"`

### 示例 B

- 在 `aiAgent` 参数填 **workspaceRoot**：`/path/to/project`
- `toolRead` 连同一 Agent；LLM 只能读该根下文件

### 示例 C

```
toolRead + toolGrep + toolWrite ──ai_tool──→ aiAgent
```

典型流程：grep 定位 → read 细读 → write 落盘修改。

## 参见

- [Write 工具卫星](/help/nodes/toolWrite)
- [Grep 工具卫星](/help/nodes/toolGrep)
- [Skill Run 节点](/help/nodes/skillRun)
