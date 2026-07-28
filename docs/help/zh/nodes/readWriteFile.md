# Read/Write File 节点

## 用途

在 **API 进程所在主机** 上读写本地文件，支持文本与二进制。适合落盘 HTTP 下载结果、读取配置文件、追加日志、将 `$binary` 附件写入磁盘等场景。

路径与内容字段支持 `{{ }}` 模板，可按每条 Item 动态解析。自动创建父目录（`mkdir` recursive）。Plus 轨节点，须在 Plus / Standard 部署中启用相应执行器。

## 端口与连接

Read/Write File 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
httpRequest → readWriteFile（writeBinary）→ set …
manualTrigger → readWriteFile（read）→ code …
```

## 参数

| 参数 | 说明 |
|------|------|
| **操作**（`operation`） | `read` / `readBinary` / `write` / `writeBinary` / `append` |
| **路径**（`path`） | 绝对或相对路径；支持模板，如 `{{ $json.filePath }}` |
| **Binary 属性名**（`binaryPropertyName`） | 默认 `data`；读写二进制时与 HTTP 节点 Binary 属性名一致 |
| **内容**（`content`） | Write/Append 可选；留空时 Write 可写入上游 `item.binary` |

### 各操作行为

| 操作 | 输入 | 输出 `$json` |
|------|------|--------------|
| **read** | 路径 | `{ operation, path, content }` 文本 |
| **readBinary** | 路径 | `{ operation, path, fileSize, mimeType }` + `$binary[propertyName]` |
| **write** | 路径 + 文本或 binary | `{ operation, path, bytesWritten }` |
| **writeBinary** | 路径 + `$binary` | 同上 |
| **append** | 路径 + 文本 | `{ operation, path, bytesWritten }` |

**Write 智能回退**：未填 `content` 且 item 含对应 `binary` 时，按二进制写入（等同 writeBinary）。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2002** | 路径为空；文件不存在（read）；binary 缺失或仅有 ref 未 hydrate |
| `ENOENT` | 读取路径不存在 |
| `binary.data 无可用数据` | writeBinary 时 item 无有效 binary |
| 权限不足 | 进程对目标目录无写权限 |

## 示例

### 示例 A

读取文本配置（复制参数）：

| 键 | 值 |
|----|-----|
| `operation` | `read` |
| `path` | `D:/app/config.json` |

### 示例 B

最小工作流：HTTP 下载后写二进制文件：

```json
{
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Trigger",
      "position": { "x": 0, "y": 0 },
      "parameters": {}
    },
    {
      "id": "rw1",
      "type": "readWriteFile",
      "name": "Save",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "operation": "writeBinary",
        "path": "D:/downloads/out.png",
        "binaryPropertyName": "data"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "Save", "type": "main", "index": 0 }]]
    }
  }
}
```

上游 HTTP 节点须将响应放入 `$binary.data`。

### 示例 C

按 Item 动态路径追加日志：

| 键 | 值 |
|----|-----|
| `operation` | `append` |
| `path` | `{{ $json.logPath }}` |
| `content` | `{{ $json.line }}\n` |

上游每条 Item 携带 `logPath` 与 `line` 字段即可分批追加。
