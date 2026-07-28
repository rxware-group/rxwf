# LLM 节点

## 用途

调用 **Ollama** 或 **OpenAI 兼容** 接口上的大语言模型，对 **Prompt** 做一次完整（非流式 UI）对话，将模型回复写入 `$json.response`。适合简单问答、文本摘要、分类、翻译等无需 Agent 工具链的单轮 LLM 场景。

在节点参数中直接配置 **类型**、**服务地址** 与 **Model**，不依赖「设置」中的 Ollama 默认项。须已配置 AI 运行时（`deps.ai`）；未配置时报 **E3001**。

## 端口与连接

LLM 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → llm → code / set …
webhookTrigger → llm → httpRequest …
```

可与 **Knowledge** 卫星或 `ragAnswer` 配合构建 RAG；本节点本身不检索知识库。

## 参数

| 参数 | 说明 |
|------|------|
| **类型**（`provider`） | `ollama`（本地 Ollama）或 `openai-compatible`（OpenAI 兼容 API） |
| **服务地址**（`baseUrl`） | Ollama HTTP 地址，默认 `http://127.0.0.1:11434`；OpenAI 兼容时填 API Base URL |
| **Credential**（`credentialId`） | 类型为 OpenAI 兼容时选择 API Key 凭据 |
| **Model**（`model`） | 模型名；填写服务地址后点击输入框可拉取本机模型列表（Ollama） |
| **Prompt**（`prompt`） | 用户消息；支持 `{{ }}`，如 `{{ $json.question }}` |

### 输出

```json
{ "response": "模型完整回复文本" }
```

内部通过 AI 运行时 `chat` 流式聚合为单字符串写入 `response` 字段。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E3001** | AI 运行时未配置；模型服务不可达 |
| 模型不存在 | 服务返回 model not found |
| 空 Prompt | 仍可执行，但回复可能无意义 |

## 示例

### 示例 A

复制参数（固定 Prompt）：

| 键 | 值 |
|----|-----|
| `provider` | `ollama` |
| `baseUrl` | `http://127.0.0.1:11434` |
| `model` | `llama3` |
| `prompt` | `用一句话介绍工作流自动化。` |

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
      "parameters": { "json": { "question": "什么是 RxWF？" } }
    },
    {
      "id": "o1",
      "type": "llm",
      "name": "LLM",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "provider": "ollama",
        "baseUrl": "http://127.0.0.1:11434",
        "model": "llama3",
        "prompt": "{{ $json.question }}"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "LLM", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

结合 Set 预处理上下文：

| 键 | 值 |
|----|-----|
| `prompt` | `背景：{{ $json.context }}\n\n问题：{{ $json.question }}` |

上游 Set 写入 `context` 与 `question` 两字段即可。
