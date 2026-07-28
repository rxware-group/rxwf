# RAG 检索节点

## 用途

从指定 **知识库** 检索与查询文本相关的文档片段（**不调用 LLM**），将命中 chunk 列表作为多条 Items 输出。每条 Item 的 `$json` 含 `text`、`score`、`documentName`、`chunkIndex` 等字段，供下游 Code、Set 或 LLM 节点继续处理。

适合「只要检索结果、自行拼 Prompt」的流水线，或与 `ragAnswer` 对比：本节点仅检索，不生成自然语言答案。

## 端口与连接

RAG 检索为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → ragRetrieve → code / ollama …
webhookTrigger → ragRetrieve → set …
```

检索前须在侧栏 **知识库** 上传文档并等待 **indexed** 状态。

## 参数

| 参数 | 说明 |
|------|------|
| **知识库 ID**（`knowledgeBaseIds`） | 一个或多个 UUID；面板为多选，存为数组 |
| **查询**（`query`） | 检索文本；支持模板；留空时取 `$json.query` / `question` / `content` / `text` |

### 输出 Item 字段

| 字段 | 说明 |
|------|------|
| `id` | chunk ID |
| `text` | 片段正文 |
| `score` | 相似度分数 |
| `documentId` / `documentName` | 来源文档 |
| `chunkIndex` | 块序号 |
| `knowledgeBaseId` | 所属知识库 |

无命中时抛出 **E3003**（节点 failed）。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1004** | 未配置 `knowledgeBaseIds`；或 query 为空 |
| **E3001** | Knowledge 服务未配置 |
| **E3003** | 检索无命中（库内无相关内容或阈值过高） |
| **E1001** | 知识库 ID 不存在 |

## 示例

### 示例 A

复制参数：

| 键 | 值 |
|----|-----|
| `knowledgeBaseIds` | `["<kb-uuid>"]` |
| `query` | `{{ $json.question }}` |

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
      "parameters": { "json": { "question": "如何重置密码？" } }
    },
    {
      "id": "rr1",
      "type": "ragRetrieve",
      "name": "RAG Retrieve",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "knowledgeBaseIds": ["<kb-uuid>"],
        "query": "{{ $json.question }}"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "RAG Retrieve", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

多库联合检索 + 下游 Code 拼接：

| 键 | 值 |
|----|-----|
| `knowledgeBaseIds` | `["<faq-kb>", "<manual-kb>"]` |
| `query` | `{{ $json.q }}` |

下游 Code：`return [{ json: { context: $input.map(i => i.json.text).join('\n---\n') } }];`
