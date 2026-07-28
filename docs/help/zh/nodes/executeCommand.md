# Execute Command 节点

## 用途

在 **API 进程或远程 Runner** 上执行操作系统命令，将 **stdout**、**stderr** 与 **exitCode** 写入下游 `$json`。适合调用 CLI 工具、脚本包装器、系统诊断命令等无法用 HTTP/Code 覆盖的场景。

每条上游 Item 触发一次命令执行；运行时向子进程注入环境变量 **`RXWF_JSON`**（当前 item 的 JSON 字符串），供脚本读取。Windows 下使用 `cmd.exe` 或 `spawn` shell 模式；Linux/macOS 使用 `/bin/sh` 或 `spawn`。

## 端口与连接

Execute Command 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → executeCommand → if / code …
```

> **远程执行**：仅 `code` 与 `executeCommand` 可经 Agent WebSocket 远程派发；Runner 须具备 `shell` capability。

## 参数

| 参数 | 说明 |
|------|------|
| **命令**（`command`） | 可执行文件或 shell 命令名；支持 `{{ }}` 模板 |
| **参数**（`args`） | 字符串数组，每项一个 argv；至少一项非空（新版） |
| **工作目录**（`cwd`） | 可选；子进程启动目录 |
| **超时 (ms)**（`timeoutMs`） | 默认 **120 秒**；`0` 表示不超时；`-1` 或留空同默认 |

### 旧版兼容

若工作流仅有单个 **命令** 字段、无 `args` 数组，则整行作为 **legacy shell line** 交给系统 shell 解释（如 `echo hello`）。

### 输出字段

每条 Item 输出：

| 字段 | 说明 |
|------|------|
| `stdout` | 标准输出（trimEnd） |
| `stderr` | 标准错误 |
| `exitCode` | 进程退出码；非 0 时节点 **failed** |
| `error` | 超时或 spawn 异常时的消息 |
| `legacyShellLine` | 旧版 shell 模式时为 `true` |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2002** | 命令为空；或新版模式下 `args` 全空；或部分 item 的 `exitCode !== 0` |
| 命令超时 | 超过 `timeoutMs` 后 kill 子进程，`error: Command timed out` |
| **E2016** | 策略要求远程 Runner 但无可用 Agent（回退或失败，视配置） |

## 示例

### 示例 A

复制参数（Windows 列目录）：

| 键 | 值 |
|----|-----|
| `command` | `cmd` |
| `args` | `["/c", "dir"]` |
| `cwd` | `D:\data` |
| `timeoutMs` | `60000` |

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
      "parameters": {}
    },
    {
      "id": "cmd1",
      "type": "executeCommand",
      "name": "Echo",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "command": "echo",
        "args": ["rxwf"],
        "timeoutMs": -1
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "Echo", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

按上游 JSON 动态传参（`args` 使用模板）：

| 键 | 值 |
|----|-----|
| `command` | `node` |
| `args` | `["-e", "console.log(process.env.RXWF_JSON)"]` |

上游 `set` 输出 `{ "userId": "42" }` 后，子进程可通过 `RXWF_JSON` 读取该对象。
