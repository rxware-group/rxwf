# Output Parser 节点

## 用途

**Output Parser** 是 **结构化输出卫星**：为父 **AI Agent** 提供 JSON Schema，约束模型最终回答为可解析 JSON，并在 Agent 输出 item 上写入 **`parsed`** 字段。本节点 **不参与主数据流**（无 `main` 口），须通过 **Output Parser**（`ai_outputParser`）资源口接到 Agent。

Skill Run **不支持** 此卫星；需结构化 Skill 输出时请改用 Code 节点解析或 AI Agent。

## 端口与连接

```
aiOutputParser ──ai_outputParser──→ aiAgent
aiChatModel ──ai_languageModel──→ aiAgent（Agent 仍须 Chat Model）
```

| 端口 | 说明 |
|------|------|
| **Output Parser** 出口 | `ai_outputParser` → 父 Agent 的 **Output Parser** 入口 |
| 接线方向 | 由卫星指向父 Agent |

每个 Agent **至多一个** Output Parser；重复接线 **E1014**。

## 参数

| 参数 | 说明 |
|------|------|
| **Output JSON Schema**（`jsonSchema`） | JSON Schema 对象或 JSON 字符串；约束 Agent 最终输出字段与类型 |

默认 schema 示例：`{ "type": "object", "properties": { "answer": { "type": "string" } }, "required": ["answer"] }`。

留空 `jsonSchema` 时：不注入 schema，输出 **无** `parsed` 字段（行为与未挂 Parser 相同）。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 对 Parser 节点直接 **debug-node**（无独立执行器） |
| **E1014** | 同一 Agent 连接多个 Output Parser |
| **E3013** | Agent 回答非 JSON、缺必填字段或类型不匹配 |
| **W1010** | Parser 未接到 AI Agent（孤立卫星警告） |

## 示例

### 示例 A

1. 添加 `aiOutputParser`，**jsonSchema** 保持默认（含 `answer: string`）
2. `aiAgent` 连接 Chat Model + Parser
3. Agent **System** 写明「仅输出 JSON，含 answer 字段」
4. 成功后 OUTPUT 含 `answer` 文本与 `parsed.answer`

### 示例 B

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "score": { "type": "number" }
  },
  "required": ["summary", "score"]
}
```

粘贴到 **Output JSON Schema**；上游问题如 `{ "text": "长文…" }`，Agent User 模板引用 `$json.text`。

### 示例 C

- Parser **无独立执行按钮**；须调试父 Agent
- 日志可见 `satellite_schema_read` 与合并后的 schema
- 若 **E3013**：检查模型是否输出 markdown 代码块包裹 JSON，或 System 是否要求纯 JSON

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — Output Parser 入口
- [Chat Model 节点](/help/nodes/aiChatModel) — 必填语言模型
