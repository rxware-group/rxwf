# LLM Stream 节点

## 用途

调用 **Ollama** 模型生成回复，输出字段为 **`stream`**（完整聚合文本）。与 **Ollama** 节点共用同一 AI 运行时与模型解析逻辑；命名强调「流式生成」语义，便于与需要 `$json.stream` 字段的下游 Code / HTTP 对接。

编辑器调试时可在执行日志中观察模型输出；节点完成后 `$json.stream` 为整段回复（非 SSE 分片）。须配置 AI 运行时，否则 **E3001**。

## 端口与连接

LLM Stream 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → llmStream → set（保存 stream）→ …
webhookTrigger → set → llmStream → code …
```

Plus 轨节点；Standard / Plus 部署需启用 Plus 执行器注册。

## 参数

| 参数 | 说明 |
|------|------|
| **Model**（`model`） | Ollama 模型名；留空用设置默认 |
| **Prompt**（`prompt`） | 用户消息；支持 `{{ $json... }}` 模板 |

### 输出

```json
{ "stream": "模型完整回复文本" }
```

### 与 Ollama 节点的区别

| | ollama | llmStream |
|---|--------|-----------|
| 输出字段 | `response` | `stream` |
| 实现 | 同一 `runOllamaChat` | 同一 `runOllamaChat` |
| 典型用途 | 通用 LLM 调用 | 下游显式消费 `stream` 字段 |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E3001** | AI 运行时未配置 |
| Ollama 连接失败 | 检查 `OLLAMA_HOST` 与服务状态 |
| 超时 | 长生成场景可在设置或上游 Wait 控制节奏 |

## 示例

### 示例 A

复制参数：

| 键 | 值 |
|----|-----|
| `model` | `qwen2.5:7b` |
| `prompt` | `{{ $json.prompt }}` |

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
      "parameters": { "json": { "prompt": "写一首俳句" } }
    },
    {
      "id": "ls1",
      "type": "llmStream",
      "name": "LLM Stream",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "prompt": "{{ $json.prompt }}"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "LLM Stream", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

下游 Code 读取 `stream`：

```javascript
return [{ json: { summary: $json.stream?.slice(0, 200) } }];
```

将 LLM Stream 输出连至 Code 即可截断摘要。
