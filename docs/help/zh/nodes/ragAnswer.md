# RAG 问答节点

## 用途

**检索知识库并调用 LLM** 生成带 **引用（citations）** 的自然语言回答。一次完成「查资料 + 写答案」，输出 `$json.answer`、`$json.citations` 与 `$json.ragMiss`（是否未命中知识库）。

支持 **support** / **code** 两种 RAG 提示模板；可开启 **无命中回退纯对话**（`fallbackToChat`），检索 **E3003** 时仍用模型直接回答并设 `ragMiss: true`。

## 端口与连接

RAG 问答为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → ragAnswer → set / httpRequest …
webhookTrigger → set → ragAnswer …
```

与卫星 **aiKnowledge** 不同：本节点走主数据流，适合 Skill Run 等无法挂 Knowledge 口的场景。

## 参数

| 参数 | 说明 |
|------|------|
| **知识库 ID**（`knowledgeBaseIds`） | 必填；多库数组 |
| **问题**（`query`） | 用户问题；留空取上游 `$json.query` 等 |
| **Model**（`model`） | Ollama 模型；留空用默认 |
| **模板**（`ragTemplate`） | `support`（客服）或 `code`（代码库） |
| **无命中回退纯对话**（`fallbackToChat`） | `true` 时 E3003 不失败，改纯 LLM 对话 |

### 输出

```json
{
  "answer": "…",
  "citations": [{ "documentName": "…", "chunkIndex": 0, "score": 0.82 }],
  "ragMiss": false
}
```

`ragMiss: true` 表示未命中知识库且走了 fallback。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1004** | 缺少知识库 ID 或 query |
| **E3001** | Knowledge 或 AI 运行时未配置 |
| **E3003** | 无命中且 `fallbackToChat` 不为 `true` |

## 示例

### 示例 A

复制参数（客服 FAQ）：

| 键 | 值 |
|----|-----|
| `knowledgeBaseIds` | `["<faq-kb-uuid>"]` |
| `query` | `{{ $json.question }}` |
| `ragTemplate` | `support` |
| `fallbackToChat` | `false` |

### 示例 B

最小工作流 JSON：

```json
{
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Trigger",
      "position": { "x": 0, "y": 0 },
      "parameters": { "json": { "question": "退款政策是什么？" } }
    },
    {
      "id": "ra1",
      "type": "ragAnswer",
      "name": "RAG Answer",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "knowledgeBaseIds": ["<kb-uuid>"],
        "query": "{{ $json.question }}",
        "fallbackToChat": "true"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "RAG Answer", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

代码库问答（`code` 模板）：

| 键 | 值 |
|----|-----|
| `knowledgeBaseIds` | `["<repo-docs-kb>"]` |
| `query` | `如何在项目中配置 Docker Compose？` |
| `ragTemplate` | `code` |
| `model` | `qwen2.5-coder:7b` |

答案中的 `citations` 可展示给前端作为引用来源。
