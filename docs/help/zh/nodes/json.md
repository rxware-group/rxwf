# JSON 节点

## 用途

**解析、转换或生成** JSON 结构，替换或扩展每条 Item 的 `json`  payload，同时 **保留** 原有 binary 附件。JSON 为 **数据** 节点，适合将模板化对象、固定 schema 或表达式结果写入 `$json`，而无需编写 Code 脚本。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 上游 Items |
| 输出 | main | 新 JSON 的 Items（binary 保留） |

```
set → json → httpRequest / merge …
```

## 参数

| 参数 | 说明 |
|------|------|
| **JSON 表达式**（`expression`） | JSON 文本，可含 `{{ }}` 模板；兼容旧字段 `data`（对象会序列化） |

| 写法 | 行为 |
|------|------|
| 纯 JSON 无模板 | 所有 Item 输出相同结构（解析自固定字符串） |
| 含 `{{ }}` | 按每条 Item 上下文逐条求值 |
| 非对象 JSON | 包装为 `{ "value": … }` |

固定 JSON 解析失败时抛 **E1002**（`Invalid JSON expression`）。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E1002** | `expression` 不是合法 JSON（无模板时） |
| 模板求值失败 | 表达式异常导致节点 failed |
| 数组被丢弃 | 顶层数组会包装为 `{ value: array }`，需知悉输出形状 |

## 示例

### 示例 A

固定 payload：`expression` 为 `{ "event": "sync", "version": 1 }`，触发器后统一注入元数据。

### 示例 B

模板对象：`{ "id": "{{ $json.id }}", "ts": "{{ $now }}" }`，逐 Item 生成上报体。

### 示例 C

引用前序节点：`{ "prev": "{{ $nodes[\"HTTP\"].json.body }}" }`，将 HTTP 响应嵌入新结构供 AI Agent 消费。
