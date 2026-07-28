# Set 节点

## 用途

**设置或覆盖** 每条输入 Item 的 JSON 字段（及可选 binary 属性），常用于字段映射、常量注入、整理上游 HTTP 响应。Set 为 **数据** 节点：一个 main 输入、一个 main 输出；对每条 Item 独立应用字段配置。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 上游 Items |
| 输出 | main | 合并字段后的 Items |

```
manualTrigger / httpRequest → set → if / json / httpRequest …
```

## 参数

| 参数 | 说明 |
|------|------|
| **模式**（`mode`） | `manual`（默认）或 `expression` |
| **字段**（`fields`） | JSON 对象，键为字段名，值为字面量或模板 |

| 模式 | 行为 |
|------|------|
| **manual** | 字段值按字面量写入（字符串内可含 `{{ }}` 由模板解析） |
| **expression** | 值以 `={{ ... }}` 形式时为完整表达式求值 |

兼容旧版 `values` 数组格式（`name` / `value` 行）。binary 字段按约定写入 `$binary` 属性（见 `set-binary` 模块）。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| 字段未生效 | `mode=manual` 时误用 `={{ }}` 整段表达式，应切换 **expression** 模式 |
| 覆盖丢失 | Set 为浅合并 `{ ...item.json, ...fields }`，嵌套对象需整段赋值 |
| 表达式失败 | 节点 failed，检查 `{{ $json.x }}` 与 `$nodes` 引用 |

## 示例

### 示例 A

**manual**：`fields` 为 `{ "status": "done", "source": "webhook" }`，为每条 Item 追加状态与来源。

### 示例 B

**expression**：`{ "total": "={{ $json.price * $json.qty }}" }`，按 Item 计算衍生字段。

### 示例 C

映射 HTTP 响应：`{ "orderId": "{{ $json.body.orderId }}", "apiUrl": "{{ $env.API_URL }}" }`，整理 httpRequest 输出供下游 IF 使用。
