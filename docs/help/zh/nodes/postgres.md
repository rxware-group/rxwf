# Postgres 节点

## 用途

对 **PostgreSQL** 数据库执行 SQL 查询（含 `SELECT` / `INSERT` / `UPDATE` / `DELETE` 等），将结果行写入下游 `$json.rows`。每条上游 Item 可触发独立查询，适合按订单 ID 查详情、批量写入、与 `$json` 字段联动的动态 SQL。

连接串优先取节点 **connectionString**，其次执行器注入的 `databaseUrl`，最后环境变量 **`RXWF_DATABASE_URL`**。Standard 部署通常通过 Docker Compose 提供 Postgres 服务。

## 端口与连接

Postgres 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → postgres → code / if …
webhookTrigger → postgres → httpRequest …
```

## 参数

| 参数 | 说明 |
|------|------|
| **SQL**（`query`） | SQL 语句；支持 `{{ }}` 模板；留空时默认 `SELECT 1` |
| **connectionString**（设置页 / 高级） | 可选；覆盖全局 `RXWF_DATABASE_URL` |

### 输出字段

| 字段 | 说明 |
|------|------|
| `query` | 实际执行的 SQL（求值后） |
| `rows` | 结果行数组 |
| `rowCount` | 影响行数 |

上游 Item 的 `$binary` 会原样保留到输出 Item。

### 动态 SQL 注意

模板求值在 isolated-vm 表达式沙箱中完成；请避免拼接不可信输入导致 SQL 注入，优先使用参数化或严格校验。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2003** | 未配置连接串（无 `connectionString` 且无 `RXWF_DATABASE_URL`） |
| **E2002** | SQL 字段显式为空字符串 |
| 连接超时 | 5 秒内无法连库（`connectionTimeoutMillis: 5000`） |
| SQL 语法 / 权限错误 | 返回数据库原始 errorMessage |

## 示例

### 示例 A

复制参数（健康检查）：

| 键 | 值 |
|----|-----|
| `query` | `SELECT 1 AS ok` |

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
      "parameters": { "json": { "userId": "42" } }
    },
    {
      "id": "pg1",
      "type": "postgres",
      "name": "Postgres",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "query": "SELECT id, name FROM users WHERE id = '{{ $json.userId }}' LIMIT 1"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "Postgres", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

批量 Items：每条 item 的 `$json.orderId` 驱动查询：

| 键 | 值 |
|----|-----|
| `query` | `SELECT status FROM orders WHERE id = '{{ $json.orderId }}'` |

上游 Merge 或多条 Trigger 输入会逐条执行并输出对应 `rows`。
