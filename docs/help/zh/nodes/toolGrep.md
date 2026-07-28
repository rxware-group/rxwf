# Grep 工具卫星

## 用途

**toolGrep** 将 **工作区内容搜索** 注册为 Agent Tool。LLM 传入 `pattern`（必填）及可选 `path`、`glob`，在 **scanRoots** 内递归匹配文件内容，返回 `{ matches, grepFallback }` 列表。适合代码库检索、日志查找等 Agent 自主探索场景。

## 端口与连接

```
toolGrep ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
```

父 Agent 须连接 **Chat Model**；搜索根目录规则同 [Read 工具卫星](/help/nodes/toolRead)。

## 参数

| 参数 | 说明 |
|------|------|
| **最大结果数**（`maxResults`） | 默认 100；embedded 遍历硬上限 50 |
| **Tool 描述** | 可选；留空使用内置描述 |

### LLM 调用参数

| 参数 | 说明 |
|------|------|
| `pattern` | 搜索模式（支持正则），**必填** |
| `path` | 可选子目录 |
| `glob` | 可选文件名 glob 过滤 |

embedded 实现在 scanRoots 内递归遍历；大仓库建议 LLM 传入较窄 `path` 或 `glob` 以免触及 **maxResults** 上限。Skill Run embedded 路径经 `invokeSkillRunFilesystem`（M-2 已验收）。

返回结构含 `matches` 数组与 `grepFallback` 标记，便于 Agent 在无法使用 ripgrep 时仍获得行级命中。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 对 toolGrep 直接 debug-node |
| **E2002** | `pattern` 为空或非法正则 |
| **E1056** | `path` 超出 scanRoots |
| **E1041** | 目录遍历或读文件失败 |
| **E3012** | 不支持的 source 类型 |

## 示例

### 示例 A

1. `toolGrep` 命名为 `search_code`，连到 `aiAgent`
2. Prompt：「找出 src 下含 TODO 的行」
3. LLM 调用 `search_code`，`pattern: "TODO"`, `path: "src"`

### 示例 B

- `pattern`: `function authenticate`
- `glob`: `*.ts`
- 仅在 TypeScript 文件中搜索

### 示例 C

M-2 起 Skill Run 须 **显式** 连接 toolGrep；`skill-run.test.ts` 覆盖 skillRun + toolGrep 端到端。与 toolRead 组合可实现「搜索 → 读取 → 修改」流水线。

## 参见

- [Read 工具卫星](/help/nodes/toolRead)
- [Write 工具卫星](/help/nodes/toolWrite)
- [Shell 工具卫星](/help/nodes/toolShell)
